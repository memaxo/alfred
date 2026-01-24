AI SDK RSCuseStreamableValue

Copy markdown

# `useStreamableValue`

AI SDK RSC is currently experimental. We recommend using AI SDK UI for production. For guidance on migrating from RSC to UI, see our migration guide.

It is a React hook that takes a streamable value created using `createStreamableValue` and returns the current value, error, and pending state.

## Import

    import { useStreamableValue } from "@ai-sdk/rsc"

## Example

This is useful for consuming streamable values received from a component's props.

    function MyComponent({ streamableValue }) {

      const [data, error, pending] = useStreamableValue(streamableValue);




      if (pending) return Loading...;

      if (error) return Error: {error.message};




      return Data: {data};

    }

## API Signature

### Parameters

It accepts a streamable value created using `createStreamableValue`.

### Returns

It is an array, where the first element contains the data, the second element contains an error if it is thrown anytime during the stream, and the third is a boolean indicating if the value is pending.

Previous

useUIState

Next

render (Removed)
