# 🚨 Debug Card Creation RLS Issue

The error `new row violates row-level security policy for table "cards"` means the user doesn't have permission to create cards on this board according to the RLS policy.

## 🔍 Step-by-Step Debugging

### Step 1: Run the Debug SQL Function
First, run this SQL in Supabase SQL Editor:
```sql
-- This creates the debug function
```
Then copy the contents of `debug_board_membership_function.sql` and run it.

### Step 2: Check Your Board Access
Replace `YOUR_BOARD_ID` with the actual board ID and run in Supabase SQL Editor:

```sql
-- Check current user and board access
SELECT 
  auth.uid() as my_user_id,
  auth.email() as my_email;

-- Test board membership function
SELECT check_board_membership('YOUR_BOARD_ID', auth.uid());
```

### Step 3: Use the Debug API Endpoint
Navigate to this URL in your browser (replace with your actual board ID):
```
http://localhost:3000/api/debug/board-access?board_id=YOUR_BOARD_ID
```

This will show detailed debug information about:
- Current user
- Board details  
- Your membership status
- All board members
- RLS policy test results

### Step 4: Check Board Creation Trigger
The issue might be that when boards are created, the owner isn't being added to `board_members` table.

Run this SQL to check:
```sql
-- Check if board creation trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'boards';

-- Check if handle_new_board function exists
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_board';
```

### Step 5: Manual Board Membership Fix
If the trigger isn't working, manually add yourself to the board:

```sql
-- Replace with your actual board ID and user ID
INSERT INTO board_members (board_id, profile_id, role)
VALUES ('YOUR_BOARD_ID', auth.uid(), 'admin')
ON CONFLICT (board_id, profile_id) DO NOTHING;
```

### Step 6: Test Card Creation Again
After fixing board membership, try creating a card again.

## 🔧 Common Issues & Solutions

### Issue 1: Board Owner Not in board_members
**Symptom**: Board creator can't create cards
**Solution**: 
```sql
-- Fix missing board membership for board owner
INSERT INTO board_members (board_id, profile_id, role)
SELECT id, owner_id, 'admin'
FROM boards
WHERE owner_id = auth.uid()
AND NOT EXISTS (
  SELECT 1 FROM board_members 
  WHERE board_id = boards.id AND profile_id = boards.owner_id
);
```

### Issue 2: Trigger Not Working
**Symptom**: `handle_new_board()` trigger doesn't add owner to board_members
**Solution**: Recreate the trigger:
```sql
-- Recreate board creation trigger
CREATE OR REPLACE FUNCTION handle_new_board()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO board_members (board_id, profile_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_board_created ON boards;
CREATE TRIGGER on_board_created
  AFTER INSERT ON boards
  FOR EACH ROW EXECUTE FUNCTION handle_new_board();
```

### Issue 3: Wrong Board ID
**Symptom**: "Board Not Found" error
**Solution**: Check the URL and make sure you're using the correct board ID

### Issue 4: RLS Policy Too Restrictive
**Symptom**: Policy blocks even board owners
**Solution**: Check cards RLS policy allows board members:
```sql
-- Current cards RLS policy should be:
DROP POLICY IF EXISTS "Board members can create and update cards" ON cards;
CREATE POLICY "Board members can create and update cards"
  ON cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM board_members
      WHERE board_members.board_id = cards.board_id 
      AND board_members.profile_id = auth.uid()
    )
  );
```

## 📋 Debug Checklist

- [ ] Run debug function and check results
- [ ] Use debug API endpoint  
- [ ] Verify board creation trigger exists
- [ ] Check if you're in board_members table
- [ ] Test manual board membership addition
- [ ] Verify cards RLS policy
- [ ] Test card creation after fixes

## 🎯 Expected Results

After debugging, you should see:
- ✅ `user_is_board_member: true` in debug results
- ✅ Your user ID in board_members table  
- ✅ Cards create successfully
- ✅ No more RLS policy violations

Run through this checklist and let me know what you find! 