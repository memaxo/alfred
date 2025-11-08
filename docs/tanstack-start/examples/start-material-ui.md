///
 import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
 import {
 HeadContent,
 Outlet,
 Scripts,
 createRootRoute,
 } from '@tanstack/react-router'
 import { CacheProvider } from '@emotion/react'
 import { Container, CssBaseline, ThemeProvider } from '@mui/material'
 import createCache from '@emotion/cache'
 import fontsourceVariableRobotoCss from '@fontsource-variable/roboto?url'
 import React from 'react'
 import { theme } from '~/setup/theme'
 import { Header } from '~/components/Header'

 export const Route = createRootRoute({
 head: () => ({
 links: [{ rel: 'stylesheet', href: fontsourceVariableRobotoCss }],
 }),
 component: RootComponent,
 })

 function RootComponent() {
 return (



 )
 }

 function Providers({ children }: { children: React.ReactNode }) {
 const emotionCache = createCache({ key: 'css' })

 return (



 {children}


 )
 }

 function RootDocument({ children }: { children: React.ReactNode }) {
 return (









 {children}







 )
 }



 ///
 import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
 import {
 HeadContent,
 Outlet,
 Scripts,
 createRootRoute,
 } from '@tanstack/react-router'
 import { CacheProvider } from '@emotion/react'
 import { Container, CssBaseline, ThemeProvider } from '@mui/material'
 import createCache from '@emotion/cache'
 import fontsourceVariableRobotoCss from '@fontsource-variable/roboto?url'
 import React from 'react'
 import { theme } from '~/setup/theme'
 import { Header } from '~/components/Header'

 export const Route = createRootRoute({
 head: () => ({
 links: [{ rel: 'stylesheet', href: fontsourceVariableRobotoCss }],
 }),
 component: RootComponent,
 })

 function RootComponent() {
 return (



 )
 }

 function Providers({ children }: { children: React.ReactNode }) {
 const emotionCache = createCache({ key: 'css' })

 return (



 {children}


 )
 }

 function RootDocument({ children }: { children: React.ReactNode }) {
 return (









 {children}







 )
 }