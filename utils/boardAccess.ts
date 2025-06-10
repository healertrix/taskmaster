import { createClient } from '@/utils/supabase/client';

/**
 * Updates the user's recent boards list in their profile
 * Maintains the 3 most recently accessed boards
 * @param boardId - The ID of the board that was accessed
 */
export async function trackBoardAccess(boardId: string): Promise<void> {
  try {
    const supabase = createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Error getting user for board access tracking:', userError);
      return;
    }

    // Get current recent_boards array from user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('recent_boards')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error(
        'Error fetching user profile for recent boards:',
        profileError
      );
      return;
    }

    // Get current recent boards array (or empty array if null)
    const currentRecentBoards: string[] = profile?.recent_boards || [];

    // Remove the board if it already exists in the array
    const filteredBoards = currentRecentBoards.filter((id) => id !== boardId);

    // Add the new board to the front
    const updatedRecentBoards = [boardId, ...filteredBoards];

    // Keep only the 3 most recent
    const recentBoards = updatedRecentBoards.slice(0, 3);

    // Update the user's profile with the new recent_boards array
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ recent_boards: recentBoards })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating recent boards in profile:', updateError);
      return;
    }

    // Successfully updated recent boards
  } catch (error) {
    console.error('Unexpected error in trackBoardAccess:', error);
  }
}

/**
 * Gets the user's recent boards from their profile
 * @returns Array of recent board IDs (up to 3)
 */
export async function getRecentBoardIds(): Promise<string[]> {
  try {
    const supabase = createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return [];
    }

    // Get recent_boards array from user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('recent_boards')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching recent boards from profile:', profileError);
      return [];
    }

    return profile?.recent_boards || [];
  } catch (error) {
    console.error('Unexpected error in getRecentBoardIds:', error);
    return [];
  }
}
