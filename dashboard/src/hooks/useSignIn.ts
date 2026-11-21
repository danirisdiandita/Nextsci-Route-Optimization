import { useMutation, useQueryClient } from '@tanstack/react-query'
import { signIn } from '../api/auth'
import { queryKeys } from './queryKeys'

export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => signIn(email, password),
    onSuccess: (signedIn) => queryClient.setQueryData(queryKeys.session, signedIn),
  })
}
