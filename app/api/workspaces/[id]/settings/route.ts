import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET /api/workspaces/[id]/settings - Fetch workspace settings
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workspaceId = params.id;
    const supabase = createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a member of the workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch workspace settings
    const { data: settings, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('setting_type, setting_value')
      .eq('workspace_id', workspaceId);

    if (settingsError) {
      throw settingsError;
    }

    // Process settings into structured format
    const processedSettings = {
      membership_restriction: 'anyone',
      board_creation_restriction: {
        public_boards: 'any_member',
        workspace_visible_boards: 'any_member',
        private_boards: 'any_member',
      },
      board_deletion_restriction: {
        public_boards: 'any_member',
        workspace_visible_boards: 'any_member',
        private_boards: 'any_member',
      },
      board_sharing_restriction: 'anyone',
    };

    if (settings && settings.length > 0) {
      settings.forEach((setting) => {
        const settingType = setting.setting_type;
        let value;

        try {
          if (typeof setting.setting_value === 'string') {
            value = JSON.parse(setting.setting_value);
          } else {
            value = setting.setting_value;
          }
        } catch (error) {
          console.error(`Error parsing setting ${settingType}:`, error);
          return;
        }

        if (settingType in processedSettings) {
          (processedSettings as any)[settingType] = value;
        }
      });
    }

    return NextResponse.json({
      settings: processedSettings,
      userRole: membership.role,
    });
  } catch (error) {
    console.error('Error in GET /api/workspaces/[id]/settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/[id]/settings - Update workspace settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workspaceId = params.id;
    const supabase = createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to update settings (admin or owner)
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (membership.role !== 'admin' && membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only admins and owners can update settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { settingType, settingValue } = body;

    if (!settingType || settingValue === undefined) {
      return NextResponse.json(
        { error: 'Setting type and value are required' },
        { status: 400 }
      );
    }

    // Validate setting types
    const validSettingTypes = [
      'membership_restriction',
      'board_creation_restriction',
      'board_deletion_restriction',
      'board_sharing_restriction',
    ];

    if (!validSettingTypes.includes(settingType)) {
      return NextResponse.json(
        { error: 'Invalid setting type' },
        { status: 400 }
      );
    }

    // Update or insert the setting
    const { error: upsertError } = await supabase
      .from('workspace_settings')
      .upsert(
        {
          workspace_id: workspaceId,
          setting_type: settingType,
          setting_value: JSON.stringify(settingValue),
          set_by: user.id,
        },
        {
          onConflict: 'workspace_id,setting_type',
        }
      );

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/workspaces/[id]/settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
