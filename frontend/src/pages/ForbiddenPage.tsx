import StatusPage from '../components/StatusPage'

export default function ForbiddenPage() {
  return (
    <StatusPage code="403" title="You can't open this page">
      Your account doesn't have access to this area.
    </StatusPage>
  )
}
