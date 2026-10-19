import { useDeferredValue, useState } from 'react'
import { COMMUNITY_CATEGORIES, COMMUNITY_SORTS, communityHref } from '../../data/communities'
import { num, setParams, useCommunities, useParams } from '../../lib/community'
import { EmptyState, Icon, Loader, Logo, SampleBadge, SmartLink } from './ui'

function CommunityCard({ community }) {
  return (
    <li className="cm-card" style={{ '--acc': community.accent }}>
      <div className="cm-card__top">
        <Logo community={community} />
        <span className="cm-card__group">{community.group}</span>
      </div>
      <h3><SmartLink href={communityHref(community)} className="cm-card__link">{community.name}</SmartLink></h3>
      <p className="cm-card__tag">{community.tagline}</p>
      <p className="cm-card__about">{community.about}</p>
      <dl className="cm-stats">
        <div><Icon name="users" /><dt className="sr-only">Followers</dt><dd>{num(community.followers)} followers</dd></div>
        {community.upcomingCount > 0 && <div><Icon name="calendar" /><dt className="sr-only">Upcoming events</dt><dd>{community.upcomingCount} upcoming {community.upcomingCount === 1 ? 'event' : 'events'}</dd></div>}
      </dl>
      <div className="cm-card__foot">
        {community.sample && <SampleBadge>Demo counts</SampleBadge>}
        <span className="cm-card__cta">Explore Community <Icon name="arrowRight" /></span>
      </div>
    </li>
  )
}

// Search, topic filter and sort live in the URL (?q=&category=&sort=) so a filtered view can be shared.
export default function Directory() {
  const params = useParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const category = params.get('category') ?? 'All'
  const sort = params.get('sort') ?? 'default'
  const query = useDeferredValue(q)
  const { data, loading } = useCommunities({ q: query, category, sort })

  const update = (next) => setParams(params, {
    q: next.q ?? params.get('q'),
    category: next.category === 'All' ? '' : next.category ?? params.get('category'),
    sort: next.sort === 'default' ? '' : next.sort ?? params.get('sort'),
  }, { replace: true })
  const onSearch = (v) => { setQ(v); update({ q: v }) }
  const clear = () => { setQ(''); setParams(params, { q: '', category: '', sort: '' }, { replace: true }) }

  return (
    <section id="communities" className="section section--dark cm-sec" aria-labelledby="cm-title">
      <div className="cm-wrap">
        <header className="cm-sec__head">
          <p className="eyebrow">Communities</p>
          <h2 id="cm-title">Explore Communities</h2>
          <p className="lead">Find a space to learn, share your work and collaborate with people who care about the same technologies.</p>
        </header>
        <div className="cm-dir__bar">
          <label className="cm-search">
            <span className="sr-only">Search communities</span>
            <Icon name="search" />
            <input type="search" value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Search communities…" />
            {q && <button type="button" onClick={() => onSearch('')} aria-label="Clear search"><Icon name="x" /></button>}
          </label>
          <label className="cm-sort">Sort
            <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {COMMUNITY_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div role="group" aria-label="Filter by topic" className="cm-cats">
          {COMMUNITY_CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} className={`cm-cat${category === c ? ' is-on' : ''}`} onClick={() => update({ category: c })}>{c}</button>
          ))}
        </div>
        <p className="cm-dir__meta" aria-live="polite">{data ? `${data.length} ${data.length === 1 ? 'community' : 'communities'}` : ' '}</p>
        {loading && !data ? <Loader label="Loading communities" /> : data?.length ? (
          <ul className="cm-grid">{data.map((c) => <CommunityCard key={c.id} community={c} />)}</ul>
        ) : (
          <EmptyState icon="searchX" title="No community matched that search." body="Try a technology name like “graph” or “LLM”, or clear the filters."
            action={<button type="button" className="cm-btn cm-btn--ghost" onClick={clear}>Clear search</button>} />
        )}
      </div>
    </section>
  )
}
