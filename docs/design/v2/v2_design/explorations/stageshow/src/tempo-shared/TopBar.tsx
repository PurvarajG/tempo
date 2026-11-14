import { Ellipsis, Search, Square } from 'lucide-react'
import './topbar.css'

// Fader's top bar, kept as the user asked: the four destinations as a
// segmented control centred in the title bar, the running timer and the two
// tools on the right. Each direction restyles the .tb- classes.
export function TopBar() {
  return (
    <>
      <nav className="tb-seg" aria-label="Main">
        <span data-on>Today</span><span>Plan</span><span>Time</span><span>Everything</span>
      </nav>
      <div className="tb-tools">
        <span className="tb-timer"><span className="tb-timer__name">CSV export fixes</span><b>41:08</b><span className="tb-timer__stop"><Square size={9} fill="currentColor" strokeWidth={0} /></span></span>
        <Search size={15} strokeWidth={1.75} />
        <Ellipsis size={15} strokeWidth={1.75} />
      </div>
    </>
  )
}
