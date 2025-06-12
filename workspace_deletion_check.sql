-- Workspace Deletion Check Queries
-- Use these queries to verify what data exists before deletion and confirm cleanup after deletion
-- Workspace ID: 4771383f-47fd-4053-ae35-594e6f4db5b0

-- 1. WORKSPACE BASIC INFO
SELECT 'WORKSPACE' as table_name, count(*) as count FROM workspaces WHERE id = '4771383f-47fd-4053-ae35-594e6f4db5b0';

-- 2. WORKSPACE MEMBERS
SELECT 'WORKSPACE_MEMBERS' as table_name, count(*) as count FROM workspace_members WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0';

-- 3. WORKSPACE SETTINGS
SELECT 'WORKSPACE_SETTINGS' as table_name, count(*) as count FROM workspace_settings WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0';

-- 4. WORKSPACE INVITATIONS
SELECT 'WORKSPACE_INVITATIONS' as table_name, count(*) as count FROM workspace_invitations WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0';

-- 5. BOARDS IN WORKSPACE
SELECT 'BOARDS' as table_name, count(*) as count FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0';

-- 6. BOARD MEMBERS (for all boards in workspace)
SELECT 'BOARD_MEMBERS' as table_name, count(*) as count 
FROM board_members 
WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0');

-- 7. BOARD STARS (for all boards in workspace)
SELECT 'BOARD_STARS' as table_name, count(*) as count 
FROM board_stars 
WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0');

-- 8. LISTS (for all boards in workspace)
SELECT 'LISTS' as table_name, count(*) as count 
FROM lists 
WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0');

-- 9. CARDS (for all lists in boards in workspace)
SELECT 'CARDS' as table_name, count(*) as count 
FROM cards 
WHERE list_id IN (
    SELECT id FROM lists 
    WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')
);

-- 10. CARD MEMBERS (for all cards in workspace)
SELECT 'CARD_MEMBERS' as table_name, count(*) as count 
FROM card_members 
WHERE card_id IN (
    SELECT id FROM cards 
    WHERE list_id IN (
        SELECT id FROM lists 
        WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')
    )
);

-- 11. CARD LABELS (for all cards in workspace)
SELECT 'CARD_LABELS' as table_name, count(*) as count 
FROM card_labels 
WHERE card_id IN (
    SELECT id FROM cards 
    WHERE list_id IN (
        SELECT id FROM lists 
        WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')
    )
);

-- 12. CARD COMMENTS (for all cards in workspace)
SELECT 'CARD_COMMENTS' as table_name, count(*) as count 
FROM card_comments 
WHERE card_id IN (
    SELECT id FROM cards 
    WHERE list_id IN (
        SELECT id FROM lists 
        WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')
    )
);

-- 13. CARD ATTACHMENTS (for all cards in workspace)
SELECT 'CARD_ATTACHMENTS' as table_name, count(*) as count 
FROM card_attachments 
WHERE card_id IN (
    SELECT id FROM cards 
    WHERE list_id IN (
        SELECT id FROM lists 
        WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')
    )
);

-- 14. ACTIVITIES (for workspace and all boards/cards in workspace)
SELECT 'ACTIVITIES' as table_name, count(*) as count 
FROM activities 
WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0'
   OR board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')
   OR card_id IN (
       SELECT id FROM cards 
       WHERE list_id IN (
           SELECT id FROM lists 
           WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')
       )
   );

-- 15. SUMMARY QUERY - Get all counts in one result
SELECT 
    'SUMMARY' as check_type,
    (SELECT count(*) FROM workspaces WHERE id = '4771383f-47fd-4053-ae35-594e6f4db5b0') as workspaces,
    (SELECT count(*) FROM workspace_members WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0') as workspace_members,
    (SELECT count(*) FROM workspace_settings WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0') as workspace_settings,
    (SELECT count(*) FROM workspace_invitations WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0') as workspace_invitations,
    (SELECT count(*) FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0') as boards,
    (SELECT count(*) FROM board_members WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')) as board_members,
    (SELECT count(*) FROM board_stars WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')) as board_stars,
    (SELECT count(*) FROM lists WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')) as lists,
    (SELECT count(*) FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0'))) as cards,
    (SELECT count(*) FROM card_members WHERE card_id IN (SELECT id FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')))) as card_members,
    (SELECT count(*) FROM card_labels WHERE card_id IN (SELECT id FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')))) as card_labels,
    (SELECT count(*) FROM card_comments WHERE card_id IN (SELECT id FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')))) as card_comments,
    (SELECT count(*) FROM card_attachments WHERE card_id IN (SELECT id FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')))) as card_attachments,
    (SELECT count(*) FROM activities WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0' OR board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0') OR card_id IN (SELECT id FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0')))) as activities;

-- 16. DETAILED WORKSPACE INFO
SELECT 
    'WORKSPACE_DETAILS' as type,
    w.id,
    w.name,
    w.color,
    w.visibility,
    w.created_at,
    w.owner_id,
    p.email as owner_email
FROM workspaces w
LEFT JOIN profiles p ON w.owner_id = p.id
WHERE w.id = '4771383f-47fd-4053-ae35-594e6f4db5b0';

-- 17. BOARD DETAILS IN WORKSPACE
SELECT 
    'BOARD_DETAILS' as type,
    b.id,
    b.name,
    b.description,
    b.visibility,
    b.created_at,
    b.owner_id,
    p.email as owner_email
FROM boards b
LEFT JOIN profiles p ON b.owner_id = p.id
WHERE b.workspace_id = '4771383f-47fd-4053-ae35-594e6f4db5b0';

-- USAGE INSTRUCTIONS:
-- 1. Run these queries BEFORE deleting the workspace to see current data
-- 2. Delete the workspace using your application
-- 3. Run the same queries AFTER deletion to verify cleanup
-- 4. All counts should be 0 after successful deletion
-- 5. The SUMMARY query gives you a quick overview of all related data counts 