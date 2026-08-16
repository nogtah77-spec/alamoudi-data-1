'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const THEME_STORAGE_KEY = 'property-analyzer-theme'

type Theme = 'light' | 'dark'

function applyTheme(nextTheme: Theme) {
  document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  document.documentElement.style.colorScheme = nextTheme
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    const nextTheme: Theme = savedTheme === 'dark' ? 'dark' : 'light'
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }, [])

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
      applyTheme(nextTheme)
      return nextTheme
    })
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      data-theme-toggle
      onClick={toggleTheme}
      aria-label={isDark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
      title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
      className="group flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-bold text-muted-foreground shadow-sm transition hover:border-primary/50 hover:bg-muted hover:text-foreground"
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary/15">
        {isDark ? <Sun size={16} strokeWidth={2.2} /> : <Moon size={16} strokeWidth={2.2} />}
      </span>
    </button>
  )
}
