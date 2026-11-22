import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { signIn } from '@/features/auth/api'
import { queryKeys } from '@/lib/queryKeys'

export function useSignIn() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => signIn(email, password),
    // Rerunning the route guards sends the user on from the sign-in page. The form stays busy until then.
    onSuccess: (signedIn) => {
      queryClient.setQueryData(queryKeys.session, signedIn)
      return router.invalidate()
    },
  })
}
