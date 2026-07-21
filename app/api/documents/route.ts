import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'

const PARENT_TYPES = ['client', 'project', 'activity']

// Fișierul e deja urcat direct în Supabase Storage de client (browser client,
// RLS pe storage.objects verifică apartenența la workspace din path). Ruta
// asta doar înregistrează metadata în tabela documents.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getWorkspaceId(supabase)
    if (!workspaceId) return NextResponse.json({ error: 'Niciun workspace activ.' }, { status: 400 })

    const { parentType, parentId, filename, storagePath, mimeType, sizeBytes } = await req.json()

    if (!PARENT_TYPES.includes(parentType) || typeof parentId !== 'string') {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }
    if (typeof filename !== 'string' || !filename.trim() || typeof storagePath !== 'string') {
      return NextResponse.json({ error: 'Fișier invalid.' }, { status: 400 })
    }
    if (!storagePath.startsWith(`${workspaceId}/`)) {
      return NextResponse.json({ error: 'Path invalid.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('documents')
      .insert({
        workspace_id: workspaceId,
        parent_type: parentType,
        parent_id: parentId,
        filename: filename.trim(),
        storage_path: storagePath,
        mime_type: typeof mimeType === 'string' ? mimeType : null,
        size_bytes: typeof sizeBytes === 'number' ? sizeBytes : null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[documents POST]', error)
      return NextResponse.json({ error: 'Salvarea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[documents POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
