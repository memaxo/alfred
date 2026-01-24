import {
ErrorComponent,
Link,
rootRouteId,
useMatch,
useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
const router = useRouter()
const isRoot = useMatch({
strict: false,
select: (state) => state.id === rootRouteId,
})

console.error(error)

return (

{
router.invalidate()
}}
className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`}

> Try Again

{isRoot ? (

Home

) : (
{
e.preventDefault()
window.history.back()
}}

> Go Back

)}

)
}

import {
ErrorComponent,
Link,
rootRouteId,
useMatch,
useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
const router = useRouter()
const isRoot = useMatch({
strict: false,
select: (state) => state.id === rootRouteId,
})

console.error(error)

return (

{
router.invalidate()
}}
className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`}

> Try Again

{isRoot ? (

Home

) : (
{
e.preventDefault()
window.history.back()
}}

> Go Back

)}

)
}
