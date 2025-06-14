# Checklist Setup Instructions

The checklist functionality requires database tables that may not exist yet. Follow these steps to set them up:

## Quick Setup

1. **Check if tables exist:**
   ```
   GET http://localhost:3000/api/debug/checklist-tables
   ```

2. **Create tables if missing:**
   ```
   POST http://localhost:3000/api/setup/checklist-tables
   ```

## What This Creates

- **checklists table**: Stores checklist information (id, title, card_id, position, timestamps)
- **checklist_items table**: Stores individual checklist items (id, content, is_complete, position, timestamps)
- **RLS policies**: Row-level security policies for proper access control

## After Setup

Once the tables are created, checklist data will persist properly:
- ✅ Checklists will save when you create them
- ✅ Checklist items will persist after refresh
- ✅ Checkbox states will be remembered
- ✅ All checklist operations will work correctly

## Troubleshooting

If checklists still don't persist after setup:
1. Check the debug endpoint to verify tables exist
2. Check browser console for any API errors
3. Verify you have proper board member permissions

The checklist functionality should work perfectly once the database tables are properly set up! 