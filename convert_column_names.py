#!/usr/bin/env python3
"""
Script to convert column names from camelCase to snake_case in SQL backup files.
This script will process all backup files and convert camelCase column names to snake_case.
"""

import re
import os
import shutil
from pathlib import Path

def camel_to_snake(name):
    """Convert camelCase to snake_case"""
    # Insert an underscore before any uppercase letter that follows a lowercase letter or digit
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    # Insert an underscore before any uppercase letter that follows a lowercase letter
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

def convert_sql_file(file_path):
    """Convert column names in a SQL file from camelCase to snake_case"""
    print(f"Processing file: {file_path}")
    
    # Read the original file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Create backup of original file
    backup_path = str(file_path) + '.backup'
    shutil.copy2(file_path, backup_path)
    print(f"Created backup: {backup_path}")
    
    # Define column mappings based on what we found in the files
    column_mappings = {
        # Common timestamp columns
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
        'verifiedAt': 'verified_at',
        
        # ID columns
        'regionId': 'region_id',
        'categoryId': 'category_id',
        'userId': 'user_id',
        'phenomenonId': 'phenomenon_id',
        'catatanSurveiId': 'catatan_survei_id',
        'scrappingBeritaId': 'scrapping_berita_id',
        'respondenId': 'responden_id',
        
        # Other columns
        'isVerified': 'is_verified',
        'isActive': 'is_active',
        'regionCode': 'region_code',
        'analysisType': 'analysis_type',
        'nomorResponden': 'nomor_responden',
        'matchCount': 'match_count',
        'periodeSurvei': 'periode_survei',
        'startDate': 'start_date',
        'endDate': 'end_date',
        'idBerita': 'id_berita',
        'portalBerita': 'portal_berita',
        'linkBerita': 'link_berita',
        'tanggalBerita': 'tanggal_berita',
        'tanggalScrap': 'tanggal_scrap',
        'matchedKeywords': 'matched_keywords',
        'portalUrl': 'portal_url',
        'maxPages': 'max_pages',
        'delayMs': 'delay_ms',
        'cronSchedule': 'cron_schedule',
        'lastRun': 'last_run',
        'nextRun': 'next_run'
    }
    
    # Apply replacements
    modified_content = content
    replacements_made = []
    
    for camel_case, snake_case in column_mappings.items():
        # Replace in INSERT statements - look for column names in parentheses after table name
        pattern = r'\b' + re.escape(camel_case) + r'\b'
        if re.search(pattern, modified_content):
            modified_content = re.sub(pattern, snake_case, modified_content)
            replacements_made.append(f"{camel_case} -> {snake_case}")
    
    # Write the modified content back to the file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(modified_content)
    
    if replacements_made:
        print(f"Replacements made in {file_path}:")
        for replacement in replacements_made:
            print(f"  - {replacement}")
    else:
        print(f"No replacements needed in {file_path}")
    
    print()
    return len(replacements_made)

def main():
    """Main function to process all backup files"""
    backup_dir = Path("C:\\Dev\\Fenomena Project\\backup-data-only")
    
    if not backup_dir.exists():
        print(f"Error: Backup directory not found: {backup_dir}")
        return
    
    # Files to process
    sql_files = [
        "04-data-users-01.sql",
        "05-data-regions-01.sql", 
        "06-data-categories-01.sql",
        "09-data-keywords-01.sql",
        "11-data-schedules-01.sql"
    ]
    
    total_replacements = 0
    
    print("Starting column name conversion from camelCase to snake_case...")
    print("=" * 60)
    
    for sql_file in sql_files:
        file_path = backup_dir / sql_file
        if file_path.exists():
            replacements = convert_sql_file(file_path)
            total_replacements += replacements
        else:
            print(f"Warning: File not found: {file_path}")
    
    print("=" * 60)
    print(f"Conversion completed! Total replacements made: {total_replacements}")
    print()
    print("Note: Original files have been backed up with .backup extension")
    print("You can restore the original files by renaming the .backup files if needed")

if __name__ == "__main__":
    main()