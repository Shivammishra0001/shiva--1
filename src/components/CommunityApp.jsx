import Detail from './community/Detail'
import Directory from './community/Directory'
import { EventModal, EventsExplorer } from './community/Events'
import { CommunityRow, HostCTA, Hero } from './community/Home'
import { AuthDialog, SmartLink, ToastHost } from './community/ui'
import { useParams } from '../lib/community'

// One Community page.
//   /community.html                    hero, community row, events, past events, host CTA
//   /community.html?view=communities   every community, with search and filters
//   /community.html?c=<slug>           one community
//   ?event=<slug>                      event details dialog, on top of any of the above
export default function CommunityApp() {
  const params = useParams()
  const slug = params.get('c')
  const all = params.get('view') === 'communities'
  return (
    <>
      {slug ? <div className="cm-main"><Detail slug={slug} /></div> : all ? (
        <div className="cm-main"><div className="cm-wrap"><SmartLink href="/community.html" className="cm-back">← Back to Community</SmartLink></div><Directory /></div>
      ) : (
        <>
          <Hero />
          <CommunityRow />
          <EventsExplorer />
          <HostCTA />
        </>
      )}
      <EventModal />
      <AuthDialog />
      <ToastHost />
    </>
  )
}
