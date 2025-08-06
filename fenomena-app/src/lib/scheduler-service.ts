import * as cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { scrapeNewsFromPortal } from '@/lib/scraping-service';

interface ScheduledJob {
  id: string;
  task: cron.ScheduledTask;
}

class SchedulerService {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('🕒 Initializing Scheduler Service...');
    
    try {
      // Load all active schedules from database
      const activeSchedules = await prisma.scrappingSchedule.findMany({
        where: { isActive: true }
      });

      console.log(`📋 Found ${activeSchedules.length} active schedules`);

      // Create cron jobs for each active schedule
      for (const schedule of activeSchedules) {
        await this.createCronJob(schedule);
      }

      this.isInitialized = true;
      console.log('✅ Scheduler Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Scheduler Service:', error);
      throw error;
    }
  }

  private async createCronJob(schedule: any) {
    try {
      // Validate cron expression
      if (!cron.validate(schedule.cronSchedule)) {
        console.error(`❌ Invalid cron expression for schedule ${schedule.name}: ${schedule.cronSchedule}`);
        return;
      }

      const task = cron.schedule(schedule.cronSchedule, async () => {
        await this.executeScheduledScraping(schedule.id);
      }, {
        timezone: "Asia/Jakarta"
      });

      this.scheduledJobs.set(schedule.id, {
        id: schedule.id,
        task: task
      });

      // Calculate next run time
      const nextRun = this.getNextRunTime(schedule.cronSchedule);
      await prisma.scrappingSchedule.update({
        where: { id: schedule.id },
        data: { nextRun }
      });

      console.log(`✅ Created cron job for "${schedule.name}" with schedule: ${schedule.cronSchedule}`);
    } catch (error) {
      console.error(`❌ Failed to create cron job for schedule ${schedule.name}:`, error);
    }
  }

  private async executeScheduledScraping(scheduleId: string) {
    console.log(`🚀 Executing scheduled scraping for schedule ID: ${scheduleId}`);
    
    try {
      // Get schedule details
      const schedule = await prisma.scrappingSchedule.findUnique({
        where: { id: scheduleId }
      });

      if (!schedule || !schedule.isActive) {
        console.log(`⚠️ Schedule ${scheduleId} is inactive or not found`);
        return;
      }

      // Update lastRun and nextRun
      const now = new Date();
      const nextRun = this.getNextRunTime(schedule.cronSchedule);
      
      await prisma.scrappingSchedule.update({
        where: { id: scheduleId },
        data: { 
          lastRun: now,
          nextRun: nextRun
        }
      });

      // Execute scraping using existing service
      console.log(`🔍 Starting scraping for "${schedule.name}" from ${schedule.portalUrl}`);
      
      const scrapingResult = await scrapeNewsFromPortal({
        portalUrl: schedule.portalUrl,
        maxPages: schedule.maxPages,
        delayMs: schedule.delayMs
      });

      console.log(`✅ Scheduled scraping completed for "${schedule.name}":`, {
        totalScraped: scrapingResult.totalScraped,
        newItems: scrapingResult.newItems,
        duplicates: scrapingResult.duplicates,
        errors: scrapingResult.errors.length
      });

    } catch (error) {
      console.error(`❌ Failed to execute scheduled scraping for ${scheduleId}:`, error);
      
      // Update schedule with error information if needed
      await prisma.scrappingSchedule.update({
        where: { id: scheduleId },
        data: { 
          lastRun: new Date(),
          nextRun: this.getNextRunTime((await prisma.scrappingSchedule.findUnique({
            where: { id: scheduleId }
          }))?.cronSchedule || '0 0 * * *')
        }
      });
    }
  }

  private getNextRunTime(cronExpression: string): Date {
    try {
      // Parse cron expression and calculate next run
      // This is a simplified version - in production you might want to use a more robust cron parser
      const now = new Date();
      
      // For now, add 24 hours as a fallback
      // In a real implementation, you'd parse the cron expression properly
      const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      return nextRun;
    } catch (error) {
      console.error('Error calculating next run time:', error);
      // Fallback: add 24 hours
      const now = new Date();
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  async addSchedule(scheduleData: any) {
    try {
      console.log(`➕ Adding new schedule: ${scheduleData.name}`);
      
      // Create schedule in database
      const schedule = await prisma.scrappingSchedule.create({
        data: {
          name: scheduleData.name,
          portalUrl: scheduleData.portalUrl,
          maxPages: scheduleData.maxPages || 5,
          delayMs: scheduleData.delayMs || 2000,
          cronSchedule: scheduleData.cronSchedule,
          isActive: scheduleData.isActive !== false,
          nextRun: this.getNextRunTime(scheduleData.cronSchedule)
        }
      });

      // Create cron job if active
      if (schedule.isActive) {
        await this.createCronJob(schedule);
      }

      console.log(`✅ Schedule "${schedule.name}" added successfully`);
      return schedule;
    } catch (error) {
      console.error('❌ Failed to add schedule:', error);
      throw error;
    }
  }

  async updateSchedule(scheduleId: string, updateData: any) {
    try {
      console.log(`📝 Updating schedule: ${scheduleId}`);

      // Remove existing cron job
      const existingJob = this.scheduledJobs.get(scheduleId);
      if (existingJob) {
        existingJob.task.stop();
        existingJob.task.destroy();
        this.scheduledJobs.delete(scheduleId);
      }

      // Update schedule in database
      const updatedSchedule = await prisma.scrappingSchedule.update({
        where: { id: scheduleId },
        data: {
          ...updateData,
          nextRun: updateData.cronSchedule ? this.getNextRunTime(updateData.cronSchedule) : undefined,
          updatedAt: new Date()
        }
      });

      // Create new cron job if active
      if (updatedSchedule.isActive) {
        await this.createCronJob(updatedSchedule);
      }

      console.log(`✅ Schedule "${updatedSchedule.name}" updated successfully`);
      return updatedSchedule;
    } catch (error) {
      console.error('❌ Failed to update schedule:', error);
      throw error;
    }
  }

  async deleteSchedule(scheduleId: string) {
    try {
      console.log(`🗑️ Deleting schedule: ${scheduleId}`);

      // Remove cron job
      const existingJob = this.scheduledJobs.get(scheduleId);
      if (existingJob) {
        existingJob.task.stop();
        existingJob.task.destroy();
        this.scheduledJobs.delete(scheduleId);
      }

      // Delete from database
      await prisma.scrappingSchedule.delete({
        where: { id: scheduleId }
      });

      console.log(`✅ Schedule deleted successfully`);
    } catch (error) {
      console.error('❌ Failed to delete schedule:', error);
      throw error;
    }
  }

  async toggleSchedule(scheduleId: string) {
    try {
      console.log(`🔄 Toggling schedule: ${scheduleId}`);

      const schedule = await prisma.scrappingSchedule.findUnique({
        where: { id: scheduleId }
      });

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      const newActiveState = !schedule.isActive;

      // Update database
      const updatedSchedule = await prisma.scrappingSchedule.update({
        where: { id: scheduleId },
        data: { 
          isActive: newActiveState,
          nextRun: newActiveState ? this.getNextRunTime(schedule.cronSchedule) : null
        }
      });

      // Handle cron job
      const existingJob = this.scheduledJobs.get(scheduleId);
      if (newActiveState) {
        // Activate: create cron job if not exists
        if (!existingJob) {
          await this.createCronJob(updatedSchedule);
        }
      } else {
        // Deactivate: remove cron job if exists
        if (existingJob) {
          existingJob.task.stop();
          existingJob.task.destroy();
          this.scheduledJobs.delete(scheduleId);
        }
      }

      console.log(`✅ Schedule "${schedule.name}" ${newActiveState ? 'activated' : 'deactivated'}`);
      return updatedSchedule;
    } catch (error) {
      console.error('❌ Failed to toggle schedule:', error);
      throw error;
    }
  }

  getActiveJobsCount(): number {
    return this.scheduledJobs.size;
  }

  async getAllSchedules() {
    try {
      const schedules = await prisma.scrappingSchedule.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return schedules;
    } catch (error) {
      console.error('❌ Failed to get schedules:', error);
      throw error;
    }
  }

  shutdown() {
    console.log('🛑 Shutting down Scheduler Service...');
    
    // Stop and destroy all cron jobs
    this.scheduledJobs.forEach((job) => {
      job.task.stop();
      job.task.destroy();
    });
    
    this.scheduledJobs.clear();
    this.isInitialized = false;
    
    console.log('✅ Scheduler Service shutdown complete');
  }
}

// Singleton instance
export const schedulerService = new SchedulerService();

// Available portal options (same as existing system)
export const AVAILABLE_PORTALS = [
  {
    name: 'Pontianak Post',
    url: 'https://pontianakpost.jawapos.com/daerah',
    description: 'Portal berita daerah Pontianak Post'
  },
  {
    name: 'Kalbar Online', 
    url: 'https://kalbaronline.com/berita-daerah/',
    description: 'Portal berita daerah Kalbar Online'
  },
  {
    name: 'Antara News Kalbar',
    url: 'https://kalbar.antaranews.com/kalbar',
    description: 'Portal berita Antara News Kalimantan Barat'
  },
  {
    name: 'Suara Kalbar',
    url: 'https://www.suarakalbar.co.id/category/kalbar/',
    description: 'Portal berita daerah Suara Kalbar'
  }
];

// Common cron expressions for easy selection
export const COMMON_CRON_SCHEDULES = [
  { label: 'Setiap hari jam 8 pagi', value: '0 8 * * *' },
  { label: 'Setiap hari jam 12 siang', value: '0 12 * * *' },
  { label: 'Setiap hari jam 6 sore', value: '0 18 * * *' },
  { label: 'Setiap 6 jam', value: '0 */6 * * *' },
  { label: 'Setiap 12 jam', value: '0 */12 * * *' },
  { label: 'Setiap Senin jam 9 pagi', value: '0 9 * * 1' },
  { label: 'Custom', value: 'custom' }
];