import { AnimatePresence } from 'motion/react'
import { CountryContent, type CountryContentProps } from './CountryContent'
import { PanelFrame, SheetFrame } from './PanelFrames'

type Props = Omit<CountryContentProps, 'scrollLocked'>

/** Desktop: the country in the side panel. Switching country cross-fades its content. */
export function CountryPanel(props: Props) {
  return (
    <PanelFrame labelledBy="country-heading">
      <AnimatePresence mode="wait" initial={false}>
        <CountryContent key={props.country.id} {...props} />
      </AnimatePresence>
    </PanelFrame>
  )
}

/** Mobile: the country in a bottom sheet. */
export function CountrySheet(props: Props) {
  return (
    <SheetFrame labelledBy="country-heading" onClose={props.onClose}>
      {(scrollLocked) => (
        <AnimatePresence mode="wait" initial={false}>
          <CountryContent key={props.country.id} {...props} scrollLocked={scrollLocked} />
        </AnimatePresence>
      )}
    </SheetFrame>
  )
}
