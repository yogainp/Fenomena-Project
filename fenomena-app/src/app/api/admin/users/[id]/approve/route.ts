import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireRole } from '@/lib/middleware';

// PATCH /api/admin/users/[id]/approve - Approve user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireRole(request, 'ADMIN');

    // Check if user exists
    const { data: existingUser, error: existsError } = await supabase
      .from('users')
      .select('id, username, email, isVerified')
      .eq('id', params.id)
      .single();

    if (existsError) {
      if (existsError.code === 'PGRST116') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      console.error('Error checking user exists:', existsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existingUser.isVerified) {
      return NextResponse.json({ error: 'User is already verified' }, { status: 400 });
    }

    // Approve user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('id, email, username, isVerified, verifiedAt')
      .single();

    if (updateError) {
      console.error('Error approving user:', updateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'User approved successfully',
      user: updatedUser,
    });

  } catch (error: any) {
    console.error('Approve user error:', error);
    if (error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}