import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DepotForm } from '@/features/depots/components/DepotForm'
import { useCreateDepot } from '@/features/depots/hooks/useCreateDepot'
import { useWorkspace } from '@/hooks/useWorkspace'
import { nextSetupStep } from '@/lib/setupSteps'

/** Setup step 1, and the form for any later depot (design NM 02). */
export function NewDepotPage() {
  const create = useCreateDepot()
  const navigate = useNavigate()
  const { data: workspace } = useWorkspace()
  const inSetup = !!workspace && !!nextSetupStep(workspace.setup)
  return (
    <DepotForm
      heading="Where do routes start and end?"
      depot={null}
      submitLabel="Save depot"
      pending={create.isPending}
      error={create.error}
      onSubmit={(input) =>
        create.mutate(input, {
          onSuccess: (depot) => {
            toast.success(`${depot.name} saved`)
            const next = workspace && nextSetupStep({ ...workspace.setup, depot: true })
            void navigate({ to: inSetup && next ? next.to : '/depots' })
          },
        })
      }
      secondary={
        <Button variant="outline" nativeButton={false} render={<Link to={inSetup ? '/onboarding' : '/depots'} />}>
          Back
        </Button>
      }
    />
  )
}
