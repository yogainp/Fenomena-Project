import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ 
      message: 'Test endpoint working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Test endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}