
# Workspace Management Feature

This document provides instructions on setting up and configuring the workspace management feature of the Taskmaster application.

## Implementation Summary

The workspace management feature allows users to:

1. Create new workspaces with custom names and colors
2. View their workspaces in the sidebar
3. Expand/collapse workspaces to view associated boards and members

## RLS Policy Issues

If you encounter the following error when creating workspaces:
```
new row violates row-level security policy for table "workspace_settings"
```

This happens because the database trigger `on_workspace_created` tries to automatically insert rows into the `workspace_settings` table, but there are no RLS policies allowing these inserts.

## How to Fix the RLS Issue

There are two ways to resolve this issue:

### Option 1: Add RLS Policies (Recommended)

Run the SQL statements in the `supabase/rls-policies.sql` file in your Supabase project's SQL editor. These policies will:

1. Allow workspace members to view workspace settings
2. Allow workspace owners and admins to manage workspace settings
3. Set up proper permissions for workspace members as well

### Option 2: Disable Auto-Creation Trigger

If option 1 doesn't work, you can disable the trigger that automatically creates workspace settings:

```sql
ALTER TABLE workspaces DISABLE TRIGGER on_workspace_created;
```

**Note:** If you disable this trigger, you'll need to manually create workspace members entries as implemented in the `CreateWorkspaceModal` component.

## Custom Color Feature

The workspace creation modal now supports:

1. Predefined color selection
2. Custom color selection with a color picker
3. Display of hex color values

When storing custom colors:
- Tailwind class names (e.g., `bg-blue-600`) are stored for predefined colors
- Hex codes (e.g., `#3B82F6`) are stored for custom colors

## Displaying Workspace Colors

The application uses a helper function `getColorDisplay()` to determine whether to use:
- Tailwind classes for predefined colors
- Inline CSS styles for custom colors

## Future Enhancements

Future versions of the workspace management feature will include:
- Workspace settings management
- Enhanced member management
- Workspace deletion and archiving
- Workspace sharing controls 