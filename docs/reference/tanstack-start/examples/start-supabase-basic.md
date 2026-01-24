import \* as React from 'react'

export function useMutation(opts: {
fn: (variables: TVariables) => Promise
onSuccess?: (ctx: { data: TData }) => void | Promise
}) {
const [submittedAt, setSubmittedAt] = React.useState()
const [variables, setVariables] = React.useState()
const [error, setError] = React.useState()
const [data, setData] = React.useState()
const [status, setStatus] = React.useState('idle')

const mutate = React.useCallback(
async (variables: TVariables): Promise => {
setStatus('pending')
setSubmittedAt(Date.now())
setVariables(variables)
//
try {
const data = await opts.fn(variables)
await opts.onSuccess?.({ data })
setStatus('success')
setError(undefined)
setData(data)
return data
} catch (err) {
setStatus('error')
setError(err as TError)
}
},
[opts.fn],
)

return {
status,
variables,
submittedAt,
mutate,
error,
data,
}
}

import \* as React from 'react'

export function useMutation(opts: {
fn: (variables: TVariables) => Promise
onSuccess?: (ctx: { data: TData }) => void | Promise
}) {
const [submittedAt, setSubmittedAt] = React.useState()
const [variables, setVariables] = React.useState()
const [error, setError] = React.useState()
const [data, setData] = React.useState()
const [status, setStatus] = React.useState('idle')

const mutate = React.useCallback(
async (variables: TVariables): Promise => {
setStatus('pending')
setSubmittedAt(Date.now())
setVariables(variables)
//
try {
const data = await opts.fn(variables)
await opts.onSuccess?.({ data })
setStatus('success')
setError(undefined)
setData(data)
return data
} catch (err) {
setStatus('error')
setError(err as TError)
}
},
[opts.fn],
)

return {
status,
variables,
submittedAt,
mutate,
error,
data,
}
}
