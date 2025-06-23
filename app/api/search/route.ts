import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/search - Search across cards, boards, and workspaces
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type'); // 'cards', 'boards', 'workspaces', or 'all'
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const baseUrl = new URL(request.url).origin;
    const results: any = {};

    // Search cards
    if (!type || type === 'all' || type === 'cards') {
      try {
        const cardsResponse = await fetch(
          `${baseUrl}/api/search/cards?q=${encodeURIComponent(
            query
          )}&limit=${limit}`,
          {
            headers: {
              cookie: request.headers.get('cookie') || '',
            },
          }
        );

        if (cardsResponse.ok) {
          const cardsData = await cardsResponse.json();
          results.cards = cardsData.cards || [];
        } else {
          results.cards = [];
        }
      } catch (error) {
        console.error('Error searching cards:', error);
        results.cards = [];
      }
    }

    // Search boards
    if (!type || type === 'all' || type === 'boards') {
      try {
        const boardsResponse = await fetch(
          `${baseUrl}/api/search/boards?q=${encodeURIComponent(
            query
          )}&limit=${limit}`,
          {
            headers: {
              cookie: request.headers.get('cookie') || '',
            },
          }
        );

        if (boardsResponse.ok) {
          const boardsData = await boardsResponse.json();
          results.boards = boardsData.boards || [];
        } else {
          results.boards = [];
        }
      } catch (error) {
        console.error('Error searching boards:', error);
        results.boards = [];
      }
    }

    // Search workspaces
    if (!type || type === 'all' || type === 'workspaces') {
      try {
        const workspacesResponse = await fetch(
          `${baseUrl}/api/search/workspaces?q=${encodeURIComponent(
            query
          )}&limit=${limit}`,
          {
            headers: {
              cookie: request.headers.get('cookie') || '',
            },
          }
        );

        if (workspacesResponse.ok) {
          const workspacesData = await workspacesResponse.json();
          results.workspaces = workspacesData.workspaces || [];
        } else {
          results.workspaces = [];
        }
      } catch (error) {
        console.error('Error searching workspaces:', error);
        results.workspaces = [];
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in GET /api/search:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
