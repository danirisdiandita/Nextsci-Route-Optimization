import { createOrderImport } from '@/features/stops/api'
import { useWorkspaceMutation } from '@/hooks/useWorkspaceMutation'

/** Reads a CSV file and guesses the column mapping. */
export function useCreateOrderImport() {
  return useWorkspaceMutation(({ fileName, text }: { fileName: string; text: string }) => createOrderImport(fileName, text))
}
