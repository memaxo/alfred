AI SDK CorevalibotSchema

Copy markdown

# `valibotSchema()`

`valibotSchema` is currently experimental.

`valibotSchema` is a helper function that converts a Valibot schema into a JSON schema object that is compatible with the AI SDK. It takes a Valibot schema as input, and returns a typed schema.

You can use it to generate structured data and in tools.

## Example

    import { valibotSchema } from '@ai-sdk/valibot';

    import { object, string, array } from 'valibot';




    const recipeSchema = valibotSchema(

      object({

        name: string(),

        ingredients: array(

          object({

            name: string(),

            amount: string(),

          }),

        ),

        steps: array(string()),

      }),

    );

## Import

    import { valibotSchema } from "ai"

## API Signature

### Parameters

### valibotSchema:

GenericSchema

The Valibot schema definition.

### Returns

A Schema object that is compatible with the AI SDK, containing both the JSON schema representation and validation functionality.

Previous

zodSchema

Next

ModelMessage
