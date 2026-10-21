import { createContext, Fragment, useContext, useEffect, useRef, useState } from 'react'
import { cohorts, communities, communityHref } from '../../data/communities'
import {
  api, num, fullDate, getCommunity, navigate, pageBase, setParams, timeAgo, toast,
  useAuth, useComments, useCommunityPosts, useEnrollment, useEvents, useFollow, useJoinFlow, useJoinedCommunityIds, useMembers, useParams,
} from '../../lib/community'
import { newsFor } from '../../data/news'
import { projectBySlug, projectsForCohort, projectStatuses } from '../../data/projects'
import { EventCard } from './Events'
import { Avatar, Dialog, EmptyState, Icon, JoinButton, Loader, Logo, Menu, ReportDialog, SampleBadge, SmartLink, Spinner } from './ui'

const Ctx = createContext(null)
const useCtx = () => useContext(Ctx)
const TABS = [
  { id: 'about', label: 'About' }, { id: 'events', label: 'Events' }, { id: 'feed', label: 'Blog' }, { id: 'members', label: 'Members' },
]
// Community: About, Events, Blog, Members. Cohort: About, Projects, Blog, Members. (The blog tab keeps the internal id 'feed'.)
const COHORT_TABS = [
  { id: 'about', label: 'About' }, { id: 'projects', label: 'Projects' }, { id: 'feed', label: 'Blog' }, { id: 'members', label: 'Members' },
]
const tabsFor = (c) => (c.cohort ? COHORT_TABS : TABS)
const STATUS_NOTE = { pending_review: 'Awaiting review. Only you can see this until a moderator has looked at it.', restricted: 'Held for urgent review. Only you can see this.', under_appeal: 'Under appeal. Only you can see this.' }
const TYPE_LABEL = { question: 'Question', announcement: 'Announcement', event: 'Event', project: 'Project update', poll: 'Poll' }
const cx = (...a) => a.filter(Boolean).join(' ')
const noun = (c) => (c.cohort ? 'cohort' : 'community')
const listFor = (c) => (c.cohort ? cohorts : communities)

// One gate for every interaction: participate(reason, action).
//   signed out -> create profile -> join -> action
//   not joined -> "Join to ..." prompt -> join -> action
//   joined     -> action
function Provider({ community, onBook, children }) {
  const flow = useJoinFlow(community)
  const [prompt, setPrompt] = useState(null)
  const [muted, setMuted] = useState(() => new Set())
  const [reporting, setReporting] = useState(null)
  const composerRef = useRef(null)

  const participate = (reason, action) => {
    if (community.cohort) return onBook?.()
    if (!flow.user) return flow.join(action)
    if (!flow.joined) return setPrompt({ reason, action })
    return action?.(flow.user)
  }
  const confirmJoin = () => {
    const next = prompt?.action
    setPrompt(null)
    flow.join(next)
  }
  return (
    <Ctx.Provider value={{ community, flow, onBook, report: setReporting, participate, muted, mute: (id) => setMuted((s) => new Set(s).add(id)), composerRef }}>
      {children}
      <ReportDialog target={reporting} onClose={() => setReporting(null)} />
      <Dialog open={!!prompt} onClose={() => setPrompt(null)} title={`Join ${community.name}`} description={prompt ? `Join the ${noun(community)} to ${prompt.reason}.` : undefined}>
        <div className="cm-joinbox"><Logo community={community} /><p>Members can post, reply, react, save and join events. You can leave at any time.</p></div>
        <div className="cm-dialog__row">
          <button type="button" className="cm-ghost" onClick={() => setPrompt(null)}>Not now</button>
          <button type="button" className="cm-btn cm-btn--primary" onClick={confirmJoin} disabled={flow.pending === 'join'}>{flow.pending === 'join' && <Spinner />}Join {noun(community)}</button>
        </div>
      </Dialog>
    </Ctx.Provider>
  )
}

/* ---------- left nav / switcher / sidebar ---------- */
function ProjectNav({ community }) {
  const params = useParams()
  const current = params.get('project')
  const list = projectsForCohort(community)
  const href = (p) => `${pageBase()}?c=${community.slug}&tab=projects${p ? `&project=${p.slug}` : ''}`
  return (
    <nav aria-label={`${community.name} projects`} className="cm-nav">
      <div>
        <h2>{community.name} projects</h2>
        <ul>
          <li><SmartLink href={href()} aria-current={!current ? 'page' : undefined} className={cx('cm-nav__item', !current && params.get('tab') === 'projects' && 'is-on')}><Logo community={community} size="xs" decorative /><span>All projects</span></SmartLink></li>
          {list.map((p) => (
            <li key={p.slug}><SmartLink href={href(p)} aria-current={current === p.slug ? 'page' : undefined} className={cx('cm-nav__item', current === p.slug && 'is-on')}><span className="cm-nav__dot" aria-hidden="true" /><span>{p.name}</span></SmartLink></li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

function Nav({ current, community }) {
  const [q, setQ] = useState('')
  const plural = community.cohort ? 'cohorts' : 'communities'
  const joined = useJoinedCommunityIds()
  const needle = q.trim().toLowerCase()
  const list = listFor(community).filter((c) => !needle || [c.name, c.tagline, ...c.keywords, ...c.categories].join(' ').toLowerCase().includes(needle))
  const mine = list.filter((c) => joined.includes(c.id))
  const rest = list.filter((c) => !joined.includes(c.id))
  const item = (c) => (
    <li key={c.id}>
      <SmartLink href={communityHref(c)} aria-current={c.slug === current ? 'page' : undefined} className={cx('cm-nav__item', c.slug === current && 'is-on')}>
        <Logo community={c} size="xs" decorative /><span>{c.name}</span>
      </SmartLink>
    </li>
  )
  return (
    <nav aria-label={`All ${plural}`} className="cm-nav">
      <label className="cm-search cm-search--sm"><span className="sr-only">Filter {plural}</span><Icon name="search" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${plural}…`} /></label>
      {mine.length > 0 && <div><h2>Your {plural}</h2><ul>{mine.map(item)}</ul></div>}
      <div><h2>{mine.length ? 'Discover' : `All ${plural}`}</h2><ul>{rest.map(item)}</ul>{!list.length && <p className="cm-muted">No match.</p>}</div>
      <SmartLink href={pageBase()} className="cm-nav__all">{community.cohort ? 'Back to cohorts →' : 'Browse the directory →'}</SmartLink>
    </nav>
  )
}

function Switcher({ current, community }) {
  return (
    <label className="cm-switch">{noun(community)[0].toUpperCase() + noun(community).slice(1)}
      <select value={current} onChange={(e) => navigate(`${pageBase()}?c=${e.target.value}`)}>
        {listFor(community).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
      </select>
    </label>
  )
}

// Resources are shown as plain text: this site doesn't send visitors to outside websites.
function Links({ community }) {
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
  const links = [
    { href: community.officialWebsite, label: 'Official website', icon: 'globe' },
    { href: community.docs, label: 'Documentation', icon: 'book' },
    { href: community.github, label: 'Code on GitHub', icon: 'code' },
  ].filter((l) => l.href)
  if (!links.length) return <p className="cm-muted cm-sm">No resources listed yet.</p>
  return (
    <ul className="cm-links">
      {links.map((l) => <li key={l.label}><span><Icon name={l.icon} />{l.label}</span><small className="cm-muted">{host(l.href)}</small></li>)}
    </ul>
  )
}

// Right column: an advertising slot and topic news. The ad is a placeholder shape for you to fill.
function AdSlot() {
  const { community } = useCtx()
  return (
    <aside className="cm-ad" aria-label="Advertisement" style={{ '--acc': community.accent }}>
      <p className="cm-ad__label">Advertisement</p>
      <div className="cm-ad__box">
        <b>Promote your product here</b>
        <span>Reach people who follow {community.name}.</span>
        <a className="cm-ad__cta" href="/contact.html">Advertise with us</a>
      </div>
    </aside>
  )
}

function News() {
  const { community } = useCtx()
  const items = newsFor(community)
  return (
    <section className="cm-panel cm-news" aria-labelledby="news-title">
      <h2 id="news-title" className="cm-h">Latest news</h2>
      <p className="cm-muted cm-xs"><SampleBadge>Sample headlines</SampleBadge> A live news feed is not connected yet.</p>
      <ul>
        {items.map((n) => (
          <li key={n.id}>
            <small>{n.source} · {community.name}</small>
            <b>{n.title}</b>
            <span>{n.summary}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Sidebar() {
  return <div className="cm-side"><AdSlot /><News /></div>
}

// Cohorts have no join flow: the call to action is always "Book your seat".
function Action({ small }) {
  const { community, flow, onBook } = useCtx()
  const enr = useEnrollment(community)
  if (community.cohort) {
    // Booking a seat (workspace) and enrolling in a cohort are different things, so they are separate buttons.
    return (
      <>
        <button type="button" className={cx('cm-btn cm-btn--ghost cm-follow', enr.enrolled && 'is-on')} aria-pressed={enr.enrolled} disabled={enr.pending} onClick={() => enr.toggle().then(() => toast(enr.enrolled ? 'You left this cohort' : 'You’re enrolled in this cohort', { tone: 'info' })).catch((e) => toast(e.message, { tone: 'error' }))}>{enr.pending && <Spinner />}{enr.enrolled ? 'Enrolled · Withdraw' : 'Enrol in cohort'}</button>
        <button type="button" className={cx('cm-btn cm-btn--primary cm-join', small && 'is-sm')} onClick={() => onBook?.()}>Book your seat</button>
      </>
    )
  }
  return <JoinButton small={small} joined={flow.joined} pending={flow.pending} onJoin={() => flow.join()} onLeave={flow.leave} name={community.name} />
}

/* ---------- header + tabs ---------- */
function Header() {
  const { community, flow } = useCtx()
  const follow = useFollow(community)
  return (
    <header className="cm-header" style={{ '--acc': community.accent }}>
      <div className="cm-header__row">
        <Logo community={community} size="lg" />
        <div className="cm-header__main">
          <p className="cm-kicker">{community.group}</p>
          <h1>{community.name}</h1>
          <p className="cm-header__tag">{community.tagline}</p>
          <p className="cm-header__meta">
            <span><Icon name="users" /> <b className="cm-count" key={follow.count} aria-live="polite">{num(follow.count)}</b> followers</span>
            {community.activeMembersCount != null && <span><span className="cm-dot" aria-hidden="true" /> {community.activeMembersCount} active today</span>}
            <SampleBadge>Demo counts</SampleBadge>
          </p>
        </div>
        <div className="cm-header__acts">
          <button type="button" className={cx('cm-btn cm-btn--ghost cm-follow', follow.following && 'is-on')} aria-pressed={follow.following} onClick={follow.toggle}>{follow.following ? 'Following' : 'Follow'}</button>
          <Action />
        </div>
      </div>
      {flow.joined && <p className="cm-banner"><Icon name="check" /> You’re part of this {noun(community)}.</p>}
    </header>
  )
}

function Tabs({ active, tabs: TABS }) {
  const params = useParams()
  const go = (id) => setParams(params, { tab: id === TABS[0].id ? '' : id })
  const onKey = (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    const i = TABS.findIndex((t) => t.id === active)
    const next = TABS[(i + d + TABS.length) % TABS.length]
    go(next.id)
    setTimeout(() => document.getElementById(`tab-${next.id}`)?.focus(), 0)
  }
  return (
    <div role="tablist" aria-label="Sections" onKeyDown={onKey} className="cm-tabs">
      {TABS.map((t) => (
        <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={active === t.id} aria-controls="community-tabpanel"
          tabIndex={active === t.id ? 0 : -1} onClick={() => go(t.id)} className={cx('cm-tab', active === t.id && 'is-on')}>{t.label}</button>
      ))}
    </div>
  )
}

/* ---------- feed ---------- */
function JoinCallout({ inline }) {
  const { community } = useCtx()
  return (
    <div className="cm-panel cm-callout">
      <div><Logo community={community} size="sm" decorative />
        <div><p><b>{community.cohort ? 'Book your seat to join the conversation.' : inline ? 'Join to participate in the conversation.' : `Join this ${noun(community)} to start a conversation.`}</b></p>
          <p className="cm-muted">Members can post, reply, react, save posts and join events.</p></div></div>
      <Action small />
    </div>
  )
}

function Feed() {
  const { community, flow, participate, muted, composerRef } = useCtx()
  const { data: posts, loading } = useCommunityPosts(community.slug)
  const visible = posts?.filter((p) => !muted.has(p.authorId))
  return (
    <div className="cm-stack">
      {flow.joined ? <CreatePost /> : <JoinCallout />}
      {visible?.some((p) => p.sample) && <SampleBadge>Sample posts</SampleBadge>}
      {loading ? <Loader label="Loading posts" /> : visible?.length ? (
        <ol className="cm-posts" aria-label={`Posts in ${community.name}`}>
          {visible.map((p, i) => (
            <Fragment key={p.id}>
              <li id={p.id}><PostCard post={p} /></li>
              {!flow.joined && i === 2 && visible.length > 3 && <li><JoinCallout inline /></li>}
            </Fragment>
          ))}
        </ol>
      ) : (
        <EmptyState icon="messages" title={`This ${noun(community)} is quiet right now.`} body="Be the first person to start the conversation."
          action={<button type="button" className="cm-btn cm-btn--primary" onClick={() => participate('create posts', () => composerRef.current?.focus())}>Create post</button>} />
      )}
    </div>
  )
}

function Architecture({ nodes, loopBack, loopLabel }) {
  const n = nodes.length, w = 96, gap = (640 - 48 - n * w) / (n - 1), x = (i) => 24 + i * (w + gap), y = 90
  return (
    <svg viewBox="0 0 640 220" className="cm-fig" aria-hidden="true">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#c9b8c7" /></marker></defs>
      {nodes.slice(0, -1).map((_, i) => <line key={i} x1={x(i) + w} y1={y + 24} x2={x(i + 1) - 4} y2={y + 24} stroke="#c9b8c7" strokeWidth="1.5" markerEnd="url(#arr)" />)}
      {loopBack && (
        <g>
          <path d={`M${x(loopBack[0]) + w / 2} ${y + 50} C ${x(loopBack[0]) + w / 2} ${y + 110}, ${x(loopBack[1]) + w / 2} ${y + 110}, ${x(loopBack[1]) + w / 2} ${y + 54}`} fill="none" stroke="#e9a98a" strokeWidth="1.5" strokeDasharray="5 5" markerEnd="url(#arr)" />
          <text x={(x(loopBack[0]) + x(loopBack[1])) / 2 + w / 2} y={y + 104} textAnchor="middle" fill="#e9a98a" fontSize="12">{loopLabel}</text>
        </g>
      )}
      {nodes.map((label, i) => (
        <g key={label}><rect x={x(i)} y={y} width={w} height="48" rx="8" fill="#281a31" stroke={i === 0 || i === n - 1 ? '#6a4f6c' : ['#f6dbc0', '#dca3c4', '#b6b0f0'][i % 3]} strokeWidth="1.5" />
          <text x={x(i) + w / 2} y={y + 29} textAnchor="middle" fill="#f8f4e9" fontSize="13">{label}</text></g>
      ))}
    </svg>
  )
}

function PollView({ post }) {
  const { participate } = useCtx()
  const { poll } = post
  const [choice, setChoice] = useState(null)
  const [pending, setPending] = useState(false)
  const vote = () => participate('vote in polls', async () => {
    setPending(true)
    try { await api.votePoll(post.id, choice); toast('Vote recorded') } finally { setPending(false) }
  })
  if (poll.myVote) {
    return (
      <div className="cm-poll">
        {poll.options.map((o) => {
          const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0
          return (
            <div key={o.id} className="cm-poll__row"><span className={cx('cm-poll__bar', o.id === poll.myVote && 'is-mine')} style={{ width: `${pct}%` }} aria-hidden="true" />
              <span className="cm-poll__txt"><span>{o.label}{o.id === poll.myVote && <Icon name="check" />}</span><span>{pct}%</span></span></div>
          )
        })}
        <p className="cm-muted cm-xs">{poll.total} votes</p>
      </div>
    )
  }
  return (
    <fieldset className="cm-poll">
      <legend className="sr-only">{post.content}</legend>
      {poll.options.map((o) => (
        <label key={o.id} className={cx('cm-poll__opt', choice === o.id && 'is-on')}>
          <input type="radio" name={`poll-${post.id}`} checked={choice === o.id} onChange={() => setChoice(o.id)} />{o.label}
        </label>
      ))}
      <div className="cm-poll__foot"><span className="cm-muted cm-xs">{poll.total} votes · results after you vote</span>
        <button type="button" className="cm-btn cm-btn--ghost is-sm" onClick={vote} disabled={!choice || pending}>{pending && <Spinner />}Vote</button></div>
    </fieldset>
  )
}

function PostCard({ post }) {
  const [open, setOpen] = useState(false)
  const [focusKey, setFocusKey] = useState(0)
  const { author } = post
  return (
    <article aria-labelledby={`post-${post.id}-author`} className={cx('cm-post', post.pinned && 'is-pinned')}>
      {post.pinned && <p className="cm-kicker cm-post__pin"><Icon name="pin" /> Pinned</p>}
      <header className="cm-post__head">
        <Avatar name={author.name} accent={author.accent} size="lg" />
        <div>
          <p><b id={`post-${post.id}-author`}>{author.name}</b>{TYPE_LABEL[post.type] && <span className="cm-tag">{TYPE_LABEL[post.type]}</span>}</p>
          <p className="cm-muted cm-sm">{author.role}{author.role && ' · '}<time dateTime={post.createdAt} title={fullDate(post.createdAt)}>{timeAgo(post.createdAt)}</time></p>
        </div>
        <PostMenu post={post} />
      </header>
      {post.serverStatus && <p className="cm-note" role="status">{STATUS_NOTE[post.serverStatus] ?? 'Not visible to others.'}</p>}
      <div className="cm-post__text">{post.content.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div>
      {post.tags?.length > 0 && <p className="cm-hashtags">{post.tags.map((t) => <span key={t}>#{t}</span>)}</p>}
      {post.images?.length > 0 && (
        <div className={cx('cm-imgs', post.images.length > 1 && 'is-2')}>
          {post.images.map((img, i) => (
            <figure key={i}>{img.figure ? <><Architecture {...img.figure} /><figcaption className="sr-only">{img.alt}</figcaption></> : <img src={img.src} alt={img.alt} loading="lazy" />}</figure>
          ))}
        </div>
      )}
      {post.link && (
        <div className="cm-linkcard">
          <Icon name="link" /><span><small>{post.link.domain}</small><b>{post.link.title}</b></span>
        </div>
      )}
      {post.project && (
        <div className="cm-projectcard">
          <p className="cm-kicker"><Icon name="rocket" /> Project · {post.project.stage}</p>
          <b>{post.project.name}</b><p className="cm-muted">{post.project.description}</p>
          <p className="cm-muted cm-xs">{post.project.tech.join(' · ')}</p>
        </div>
      )}
      {post.poll && <PollView post={post} />}
      <Actions post={post} open={open} onComment={() => { setOpen(true); setFocusKey((k) => k + 1) }} onToggle={() => setOpen((o) => !o)} />
      {open && <Thread post={post} focusKey={focusKey} />}
    </article>
  )
}

function Actions({ post, open, onComment, onToggle }) {
  const { participate } = useCtx()
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${post.id}`
  const like = () => participate('react to posts', () => api.setReaction(post.id, !post.liked))
  const save = () => participate('save posts', () => { api.setSaved(post.id, !post.saved); toast(post.saved ? 'Removed from saved' : 'Post saved', { tone: post.saved ? 'info' : 'success' }) })
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copied') } catch { toast('Couldn’t copy. Use the address bar.', { tone: 'info' }) }
  }
  return (
    <div className="cm-actions">
      <div>
        <button type="button" className={cx('cm-act', post.liked && 'is-liked')} onClick={like} aria-pressed={post.liked}>
          <Icon name="heart" className={post.liked ? 'is-fill' : ''} /><span>{post.likes}</span><span className="sr-only">{post.liked ? 'Unlike' : 'Like'}</span>
        </button>
        <button type="button" className="cm-act" onClick={post.commentsCount && !open ? onToggle : onComment} aria-expanded={open}>
          <Icon name="message" /><span>{post.commentsCount}</span><span className="sr-only">{post.commentsCount === 1 ? 'comment' : 'comments'}</span>
        </button>
      </div>
      <div>
        <Menu label="Share post" trigger={<><Icon name="share" /> <span className="cm-hide-sm">Share</span></>} items={[
          { label: 'Copy link', icon: 'link', onSelect: copy },
        ]} />
        <button type="button" className={cx('cm-act', post.saved && 'is-saved')} onClick={save} aria-pressed={post.saved}>
          <Icon name="bookmark" className={post.saved ? 'is-fill' : ''} /><span className="cm-hide-sm">{post.saved ? 'Saved' : 'Save'}</span><span className="sr-only cm-show-sm">{post.saved ? 'Saved' : 'Save'}</span>
        </button>
      </div>
    </div>
  )
}

function PostMenu({ post }) {
  const { mute, report } = useCtx()
  return (
    <Menu label="More options for this post" trigger={<Icon name="more" />} items={[
      { label: 'Copy link', icon: 'link', onSelect: () => navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}#${post.id}`).then(() => toast('Link copied')) },
      ...(post.sample || post.mine ? [] : [{ label: 'Report post', icon: 'flag', onSelect: () => report({ type: 'post', id: post.id }) }]),
      { label: `Mute ${post.author.name.split(' ')[0]}`, icon: 'bellOff', onSelect: () => { mute(post.authorId); toast(`Muted ${post.author.name} in this feed`, { tone: 'info' }) } },
    ]} />
  )
}

/* ---------- comments ---------- */
function Thread({ post, focusKey }) {
  const { data: comments, loading } = useComments(post.id, true)
  const [replyTo, setReplyTo] = useState(null)
  return (
    <div className="cm-thread">
      {loading ? <Loader label="Loading comments" /> : comments?.length ? (
        <ul>{comments.map((c) => <Comment key={c.id} comment={c} onReply={() => setReplyTo(c)} replying={replyTo?.id === c.id} post={post} onDone={() => setReplyTo(null)} />)}</ul>
      ) : <p className="cm-muted">No comments yet. Start the conversation.</p>}
      <CommentInput post={post} focusKey={focusKey} />
    </div>
  )
}

function Comment({ comment, onReply, replying, post, onDone }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? comment.replies : comment.replies.slice(0, 1)
  const hidden = comment.replies.length - shown.length
  return (
    <li>
      <CommentBody comment={comment} onReply={onReply} />
      {(shown.length > 0 || replying) && (
        <ul className="cm-replies">
          {shown.map((r) => <li key={r.id}><CommentBody comment={r} small onReply={onReply} /></li>)}
          {hidden > 0 && <li><button type="button" className="cm-linkbtn" onClick={() => setExpanded(true)}>View {hidden} more {hidden === 1 ? 'reply' : 'replies'}</button></li>}
          {replying && <li><CommentInput post={post} parent={comment} autoFocus onDone={() => { setExpanded(true); onDone() }} /></li>}
        </ul>
      )}
    </li>
  )
}

function CommentBody({ comment, small, onReply }) {
  const { author } = comment
  const { report } = useCtx()
  return (
    <div className="cm-comment">
      <Avatar name={author.name} accent={author.accent} size={small ? 'xs' : 'sm'} />
      <div>
        <div className="cm-comment__bubble"><p><b>{author.name}</b>{author.role && <span className="cm-muted"> · {author.role}</span>}</p><p>{comment.content}</p></div>
        <p className="cm-comment__meta"><time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time>
          {onReply && <button type="button" onClick={onReply}>Reply<span className="sr-only"> to {author.name}</span></button>}
          {comment.__server && !comment.mine && <button type="button" onClick={() => report({ type: 'comment', id: comment.id })}>Report<span className="sr-only"> comment by {author.name}</span></button>}
          {comment.serverStatus && <span className="cm-tag">{comment.serverStatus === 'pending_review' ? 'Awaiting review' : 'Hidden'}</span>}</p>
      </div>
    </div>
  )
}

function CommentInput({ post, parent = null, autoFocus, onDone, focusKey }) {
  const { flow, participate } = useCtx()
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const ref = useRef(null)
  useEffect(() => { if (focusKey) ref.current?.focus() }, [focusKey])
  if (post.sample) return <p className="cm-dashed"><span><Icon name="message" /> Comments are turned off on sample posts. Start a conversation by writing your own post.</span></p>
  if (!flow.joined) {
    return (
      <div className="cm-dashed"><span><Icon name="message" /> Join to {parent ? 'reply' : 'comment'}.</span>
        <button type="button" className="cm-btn cm-btn--ghost is-sm" onClick={() => participate('comment and reply')}>Join to reply</button></div>
    )
  }
  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    participate('comment', async () => {
      setPending(true)
      try {
        const r = await api.addComment(post.id, { content: text, parentCommentId: parent?.id ?? null })
        setText('')
        toast(r.message ?? (parent ? 'Reply added' : 'Comment added'), { tone: r.held ? 'info' : 'success' })
        onDone?.()
      } catch (err) { toast(err.message, { tone: 'error' }) } finally { setPending(false) }
    })
  }
  return (
    <form onSubmit={submit} className="cm-cinput">
      <Avatar name={flow.user.name} accent={flow.user.accent} size="sm" />
      <label>
        <span className="sr-only">{parent ? `Reply to ${parent.author.name}` : 'Write a comment'}</span>
        <textarea ref={ref} value={text} autoFocus={autoFocus} rows={1} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); if (e.key === 'Escape') onDone?.() }}
          placeholder={parent ? `Reply to ${parent.author.name.split(' ')[0]}…` : 'Write a comment…'} />
      </label>
      <button type="submit" className="cm-btn cm-btn--primary is-sm" disabled={!text.trim() || pending}>{pending && <Spinner />}{parent ? 'Reply' : 'Comment'}</button>
    </form>
  )
}

/* ---------- composer ---------- */
// Posts are text with an optional link. The server screens every post before it is published, so images, polls and
// project attachments (which it does not store or check) are not offered here.
function CreatePost() {
  const { community, flow, composerRef } = useCtx()
  const [text, setText] = useState('')
  const [withLink, setWithLink] = useState(false)
  const [link, setLink] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const linkOk = !withLink || /^https?:\/\/\S+\.\S+/.test(link)
  const canPost = text.trim().length > 0 && text.length <= 5000 && linkOk

  const submit = async (e) => {
    e?.preventDefault()
    if (!canPost || pending) return
    setPending(true); setError('')
    try {
      const r = await api.createPost(community.slug, { content: text, link: withLink ? link.trim() : null })
      setText(''); setLink(''); setWithLink(false)
      toast(r.message ?? 'Post published', { tone: r.held ? 'info' : 'success' })
    } catch (err) { setError(err.message) } finally { setPending(false) }
  }
  return (
    <form onSubmit={submit} className="cm-panel cm-compose" aria-label="Create a post">
      <div className="cm-compose__row">
        <Avatar name={flow.user.name} accent={flow.user.accent} size="lg" />
        <label>
          <span className="sr-only">Post text</span>
          <textarea ref={composerRef} value={text} rows={2} maxLength={5000} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit(e)}
            placeholder={`Share something with ${community.name} builders…`} />
        </label>
      </div>
      {withLink && <label className="cm-field"><span className="sr-only">Link URL</span><input type="url" autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></label>}
      {error && <p role="alert" className="cm-err">{error}</p>}
      <div className="cm-compose__foot">
        <div><button type="button" onClick={() => setWithLink((v) => !v)} aria-pressed={withLink} className={cx('cm-ghost', withLink && 'is-on')}><Icon name="link" /><span className="cm-hide-sm">Link</span><span className="sr-only cm-show-sm">Link</span></button></div>
        <button type="submit" className="cm-btn cm-btn--primary" disabled={!canPost || pending}>{pending && <Spinner />}Post</button>
      </div>
      <p className="cm-muted cm-xs">Posts follow the <a href="/legal.html?doc=guidelines" target="_blank" rel="noopener">Community Guidelines</a> and are checked before they appear.</p>
    </form>
  )
}

/* ---------- other tabs ---------- */
function About() {
  const { community } = useCtx()
  const follow = useFollow(community)
  const created = new Date(community.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  return (
    <div className="cm-stack">
      <section className="cm-panel" aria-labelledby="about-title">
        <div className="cm-side__id"><Logo community={community} size="md" decorative /><h2 id="about-title">About {community.name} {community.cohort ? 'Cohort' : 'Builders'}</h2></div>
        <p className="cm-lead">{community.cohort ? community.about : `This community is ${community.about.charAt(0).toLowerCase() + community.about.slice(1)}`}</p>
        <dl className="cm-facts">
          <div><dt>Followers</dt><dd>{num(follow.count)}</dd></div>
          {community.activeMembersCount != null && <div><dt>Active today</dt><dd>{community.activeMembersCount}</dd></div>}
          <div><dt>Created</dt><dd>{created}</dd></div>
        </dl>
      </section>
      <section className="cm-panel" aria-labelledby="topics-title"><h2 id="topics-title" className="cm-h">Topics</h2>
        <ul className="cm-chips">{community.topics.map((t) => <li key={t}>{t}</li>)}</ul></section>
      <section className="cm-panel" aria-labelledby="links-title"><h2 id="links-title" className="cm-h">Resources</h2><Links community={community} />
        {community.kind === 'company' && <p className="cm-muted cm-xs">An independent {noun(community)}. Not affiliated with or endorsed by {community.name}.</p>}</section>
    </div>
  )
}

function Events() {
  const { community } = useCtx()
  const { data, loading } = useEvents(community.slug)
  if (loading) return <Loader label="Loading events" />
  if (!data?.length) return <EmptyState icon="calendarX" title={`No events for this ${noun(community)} yet.`} body="When a related workshop or talk is scheduled, it will show up here." />
  return <div><SampleBadge>Sample events</SampleBadge><ul className="cm-evgrid cm-evgrid--2">{data.map((e) => <li key={e.id}><EventCard event={e} /></li>)}</ul></div>
}

function ArchSteps({ steps }) {
  return (
    <ol className="cm-arch" aria-label="Solution architecture">
      {steps.map((st, i) => (
        <li key={st.name}>
          <span className="cm-arch__n">{i + 1}</span>
          <b>{st.name}</b>
          <small>{st.note}</small>
        </li>
      ))}
    </ol>
  )
}

function ProjectDetail({ project }) {
  const { community } = useCtx()
  const back = `${pageBase()}?c=${community.slug}&tab=projects`
  return (
    <article className="cm-panel cm-pd">
      <SmartLink href={back} className="cm-back">← All {community.name} projects</SmartLink>
      <p className="cm-proj__stage"><Icon name="code" /> {projectStatuses[project.status].label}{project.sample && <SampleBadge>Sample project</SampleBadge>}</p>
      <h2>{project.name}</h2>
      <p className="cm-lead">{project.summary}</p>
      <dl className="cm-pd__owner">
        <div><dt>Owner</dt><dd><Avatar name={project.owner.name} size="sm" /> <span><b>{project.owner.name}</b><small>{project.owner.role}</small></span></dd></div>
        <div><dt>Built with</dt><dd><Logo community={community} size="xs" decorative /> <b>{community.name}</b></dd></div>
        <div><dt>Current stage</dt><dd>{project.stage}</dd></div>
        <div><dt>Availability</dt><dd>{project.availability}</dd></div>
      </dl>
      <h3>Solution architecture</h3>
      <ArchSteps steps={project.architecture} />
      {project.sample && <p className="cm-note">The architecture shown is a sample outline. The owner has not published a verified design yet.</p>}
      <div className="cm-pd__cols">
        <section><h3>Problem</h3><p>{project.problem}</p></section>
        <section><h3>Solution</h3><p>{project.solution}</p></section>
        <section><h3>Intended audience</h3><p>{project.audience}</p></section>
      </div>
      {project.features.length > 0 && <><h3>Key features</h3><ul className="cm-bullets">{project.features.map((f) => <li key={f}>{f}</li>)}</ul></>}
      {project.tech.length > 0 && <><h3>Technology</h3><ul className="cm-chips">{project.tech.map((t) => <li key={t}>{t}</li>)}</ul></>}
    </article>
  )
}

function Projects() {
  const { community } = useCtx()
  const params = useParams()
  const list = projectsForCohort(community)
  const open = params.get('project') && projectBySlug(community, params.get('project'))
  if (open) return <ProjectDetail project={open} />
  return (
    <div><SampleBadge>Sample projects</SampleBadge>
      <ul className="cm-cards2">{list.map((p) => (
        <li key={p.slug} className="cm-panel cm-proj">
          <p className="cm-proj__stage"><Icon name="code" /> {projectStatuses[p.status].label}</p>
          <h3><SmartLink href={`${pageBase()}?c=${community.slug}&tab=projects&project=${p.slug}`} className="cm-card__link">{p.name}</SmartLink></h3>
          <p className="cm-muted">{p.summary}</p>
          {p.tech?.length > 0 && <ul className="cm-chips">{p.tech.map((t) => <li key={t}>{t}</li>)}</ul>}
          <p className="cm-proj__by"><Avatar name={p.owner.name} size="sm" /><span><b>{p.owner.name}</b><small>Owner · {p.owner.role}</small></span></p>
        </li>))}</ul></div>
  )
}

function Members() {
  const { community } = useCtx()
  const { data, loading } = useMembers(community.slug)
  if (loading) return <Loader label="Loading members" />
  if (!data?.length) return <EmptyState icon="user" title="No members yet." body="Be the first to join." />
  return (
    <div><SampleBadge>Demo profiles</SampleBadge>
      <div className="cm-panel cm-mlist" role="table" aria-label={`${community.name} members`}>
        <div className="cm-mlist__head" role="row"><span role="columnheader">Member</span><span role="columnheader">Skills</span><span role="columnheader">Projects</span><span role="columnheader">Role</span></div>
        {data.map((m) => (
          <div key={m.id} className="cm-mlist__row" role="row">
            <span className="cm-mlist__who" role="cell">
              <Avatar name={m.name} accent={m.accent} size="md" />
              <span><b>{m.name}</b><small>{m.role}</small></span>
            </span>
            <span className="cm-mlist__skills" role="cell">{m.skills?.length ? m.skills.map((k) => <i key={k}>{k}</i>) : <small>-</small>}</span>
            <span className="cm-mlist__n" role="cell"><b>{m.projectsCount ?? 0}</b> <small>{(m.projectsCount ?? 0) === 1 ? 'project' : 'projects'}</small></span>
            <span role="cell">{m.isLocal ? <em className="cm-tag is-ok">You</em> : m.isModerator ? <em className="cm-tag">Moderator</em> : <small>Member</small>}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- page ---------- */
export default function Detail({ slug, onBook }) {
  const params = useParams()
  const community = getCommunity(slug)
  useAuth()
  const tabs = community ? tabsFor(community) : TABS
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab') : tabs[0].id
  useEffect(() => { if (community) document.title = `${community.name} ${noun(community)} | Data Science Co-Working Space` }, [community])

  if (!community) {
    return (
      <div className="cm-wrap"><EmptyState as="h1" icon="searchX" title="We couldn’t find that community." body="It may have moved, or the link is wrong."
        action={<SmartLink href={pageBase()} className="cm-btn cm-btn--primary">Browse {pageBase().includes('cohort') ? 'cohorts' : 'communities'}</SmartLink>} /></div>
    )
  }
  const Panel = { feed: Feed, about: About, events: Events, projects: Projects, members: Members }[tab]
  return (
    <Provider key={community.id} community={community} onBook={onBook}>
      <div className="cm-wrap cm-detail">
        <aside className="cm-detail__nav">{community.cohort ? <ProjectNav community={community} /> : <Nav current={community.slug} community={community} />}</aside>
        <div className="cm-detail__main">
          <Switcher current={community.slug} community={community} />
          <Header />
          <Tabs active={tab} tabs={tabs} />
          <div id="community-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="cm-panelwrap"><Panel /></div>
        </div>
        <aside className="cm-detail__side"><Sidebar /></aside>
      </div>
    </Provider>
  )
}
