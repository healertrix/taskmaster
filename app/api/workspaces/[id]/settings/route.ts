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

    // Process settings into structured format with backward compatibility
    const processedSettings = {
      membership_restriction: 'anyone',
      board_creation_simplified: 'any_member',
      board_deletion_simplified: 'any_member',
    };

    if (settings && settings.length > 0) {
      settings.forEach((setting) => {
        const settingType = setting.setting_type;

        // Handle current simplified format
        if (settingType === 'membership_restriction') {
          try {
            const value =
              typeof setting.setting_value === 'string'
                ? JSON.parse(setting.setting_value)
                : setting.setting_value;
            processedSettings.membership_restriction = value;
          } catch (error) {
            processedSettings.membership_restriction = 'anyone';
          }
        } else if (settingType === 'board_creation_simplified') {
          try {
            const value =
              typeof setting.setting_value === 'string'
                ? JSON.parse(setting.setting_value)
                : setting.setting_value;
            processedSettings.board_creation_simplified = value;
          } catch (error) {
            processedSettings.board_creation_simplified = 'any_member';
          }
        } else if (settingType === 'board_deletion_simplified') {
          try {
            const value =
              typeof setting.setting_value === 'string'
                ? JSON.parse(setting.setting_value)
                : setting.setting_value;
            processedSettings.board_deletion_simplified = value;
          } catch (error) {
            processedSettings.board_deletion_simplified = 'any_member';
          }
        }

        // Backward compatibility: Handle old complex format
        else if (settingType === 'board_creation_restriction') {
          try {
            const oldValue =
              typeof setting.setting_value === 'string'
                ? JSON.parse(setting.setting_value)
                : setting.setting_value;
            // Extract workspace visible boards setting from old format
            processedSettings.board_creation_simplified =
              oldValue?.workspace_visible_boards || 'any_member';
          } catch (error) {
            processedSettings.board_creation_simplified = 'any_member';
          }
        } else if (settingType === 'board_deletion_restriction') {
          try {
            const oldValue =
              typeof setting.setting_value === 'string'
                ? JSON.parse(setting.setting_value)
                : setting.setting_value;
            // Extract workspace visible boards setting from old format
            processedSettings.board_deletion_simplified =
              oldValue?.workspace_visible_boards || 'any_member';
          } catch (error) {
            processedSettings.board_deletion_simplified = 'any_member';
          }
        }

        // Ignore old board_sharing_restriction - no longer used
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

    // Validate setting types - only allow new simplified format
    const validSettingTypes = [
      'membership_restriction',
      'board_creation_simplified',
      'board_deletion_simplified',
    ];

    if (!validSettingTypes.includes(settingType)) {
      return NextResponse.json(
        { error: 'Invalid setting type' },
        { status: 400 }
      );
    }

    // Validate setting values
    const validValues = {
      membership_restriction: ['anyone', 'admins_only', 'owner_only'],
      board_creation_simplified: ['any_member', 'admins_only', 'owner_only'],
      board_deletion_simplified: ['any_member', 'admins_only', 'owner_only'],
    };

    if (!validValues[settingType].includes(settingValue)) {
      return NextResponse.json(
        { error: 'Invalid setting value' },
        { status: 400 }
      );
    }

    // When updating ANY setting, completely overwrite with new simplified format
    // This ensures migration from old to new format happens automatically

    // Get current settings to preserve other values
    const { data: currentSettings } = await supabase
      .from('workspace_settings')
      .select('setting_type, setting_value')
      .eq('workspace_id', workspaceId);

    // Build complete new settings object
    const newCompleteSettings = {
      membership_restriction: 'anyone',
      board_creation_simplified: 'any_member',
      board_deletion_simplified: 'any_member',
    };

    // Apply any existing simplified settings or convert from old format
    if (currentSettings) {
      currentSettings.forEach((setting) => {
        const type = setting.setting_type;

        // Handle current simplified format
        if (validSettingTypes.includes(type)) {
          try {
            const value =
              typeof setting.setting_value === 'string'
                ? JSON.parse(setting.setting_value)
                : setting.setting_value;
            newCompleteSettings[type] = value;
          } catch (error) {
            // Keep defaults
          }
        }
        // Handle old format conversion
        else if (type === 'board_creation_restriction') {
          try {
            const oldValue =
              typeof setting.setting_value === 'string'
                ? JSON.parse(setting.setting_value)
                : setting.setting_value;
            newCompleteSettings.board_creation_simplified =
              oldValue?.workspace_visible_boards || 'any_member';
          } catch (error) {
            // Keep default
          }
        } else if (type === 'board_deletion_restriction') {
          try {
            const oldValue =
              typeof setting.setting_value === 'string'
                ? JSON.parse(setting.setting_value)
                : setting.setting_value;
            newCompleteSettings.board_deletion_simplified =
              oldValue?.workspace_visible_boards || 'any_member';
          } catch (error) {
            // Keep default
          }
        }
      });
    }

    // Apply the new setting
    newCompleteSettings[settingType] = settingValue;

    // Delete all existing settings for this workspace to ensure clean migration
    const { error: deleteError } = await supabase
      .from('workspace_settings')
      .delete()
      .eq('workspace_id', workspaceId);

    if (deleteError) {
      console.error('Error deleting old settings:', deleteError);
      // Continue anyway, upsert should handle conflicts
    }

    // Insert all settings in new simplified format
    const settingsToInsert = Object.entries(newCompleteSettings).map(
      ([type, value]) => ({
        workspace_id: workspaceId,
        setting_type: type,
        setting_value: JSON.stringify(value),
        set_by: user.id,
      })
    );

    const { error: insertError } = await supabase
      .from('workspace_settings')
      .insert(settingsToInsert);

    if (insertError) {
      console.error('Error inserting new settings:', insertError);
      return NextResponse.json(
        { error: 'Failed to update workspace settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Workspace settings updated successfully',
      newSettings: newCompleteSettings,
    });
  } catch (error) {
    console.error('Error in PATCH /api/workspaces/[id]/settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
