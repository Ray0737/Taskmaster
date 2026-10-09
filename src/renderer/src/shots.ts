import { call } from './ipc'

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

// Image files on the clipboard. Call it synchronously inside the paste handler (getAsFile does not work after an await).
export const clipboardImages = (d: DataTransfer): File[] =>
  [...d.items].filter((i) => i.kind === 'file' && Object.hasOwn(EXT, i.type)).map((i) => i.getAsFile()).filter((f): f is File => !!f)

// Saves each image as a screenshot of the task; returns the stored file names.
export async function saveShots(taskId: string, files: File[]): Promise<string[]> {
  const out: string[] = []
  for (const f of files) {
    const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(r.error); r.readAsDataURL(f) })
    out.push(await call('team.addImage', taskId, b64, EXT[f.type]))
  }
  return out
}
