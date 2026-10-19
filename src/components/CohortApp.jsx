import { useEffect } from 'react'
import Detail from './community/Detail'
import { EventModal } from './community/Events'
import { AuthDialog, ToastHost } from './community/ui'
import { cohorts } from '../data/communities'
import { navigate, useParams } from '../lib/community'

// Cohort pages have no landing page: /cohort.html?c=<slug> is one cohort, and a bare /cohort.html opens the first.
//   ?tab=projects&project=<slug>   a project built with that technology
export default function CohortApp({ onBook }) {
  const slug = useParams().get('c')
  useEffect(() => { if (!slug) navigate(`/cohort.html?c=${cohorts[0].slug}`, { replace: true }) }, [slug])
  if (!slug) return null
  return (
    <>
      <div className="cm-main"><Detail slug={slug} onBook={onBook} /></div>
      <EventModal />
      <AuthDialog />
      <ToastHost />
    </>
  )
}
