import { useEffect, useState, type RefObject } from 'react'

/** The rendered size of an element in CSS pixels, kept up to date as it resizes. Zero until it mounts. */
export function useElementSize(ref: RefObject<Element | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}
