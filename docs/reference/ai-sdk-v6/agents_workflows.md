AgentsWorkflow Patterns

Copy markdown

# Workflow Patterns

Combine the building blocks from the overview with these patterns to add structure and reliability to your agents:

  * Sequential Processing \- Steps executed in order
  * Parallel Processing \- Independent tasks run simultaneously
  * Evaluation/Feedback Loops \- Results checked and improved iteratively
  * Orchestration \- Coordinating multiple components
  * Routing \- Directing work based on context

## Choose Your Approach

Consider these key factors:

  * **Flexibility vs Control** \- How much freedom does the LLM need vs how tightly you must constrain its actions?
  * **Error Tolerance** \- What are the consequences of mistakes in your use case?
  * **Cost Considerations** \- More complex systems typically mean more LLM calls and higher costs
  * **Maintenance** \- Simpler architectures are easier to debug and modify

**Start with the simplest approach that meets your needs**. Add complexity only when required by:

  1. Breaking down tasks into clear steps
  2. Adding tools for specific capabilities
  3. Implementing feedback loops for quality control
  4. Introducing multiple agents for complex workflows

Let's look at examples of these patterns in action.

## Patterns with Examples

These patterns, adapted from Anthropic's guide on building effective agents, serve as building blocks you can combine to create comprehensive workflows. Each pattern addresses specific aspects of task execution. Combine them thoughtfully to build reliable solutions for complex problems.

## Sequential Processing (Chains)

The simplest workflow pattern executes steps in a predefined order. Each step's output becomes input for the next step, creating a clear chain of operations. Use this pattern for tasks with well-defined sequences, like content generation pipelines or data transformation processes.
    
    
    import { generateText, generateObject } from 'ai';
    
    import { z } from 'zod';
    
    
    
    
    async function generateMarketingCopy(input: string) {
    
      const model = 'openai/gpt-4o';
    
    
    
    
      // First step: Generate marketing copy
    
      const { text: copy } = await generateText({
    
        model,
    
        prompt: `Write persuasive marketing copy for: ${input}. Focus on benefits and emotional appeal.`,
    
      });
    
    
    
    
      // Perform quality check on copy
    
      const { object: qualityMetrics } = await generateObject({
    
        model,
    
        schema: z.object({
    
          hasCallToAction: z.boolean(),
    
          emotionalAppeal: z.number().min(1).max(10),
    
          clarity: z.number().min(1).max(10),
    
        }),
    
        prompt: `Evaluate this marketing copy for:
    
        1. Presence of call to action (true/false)
    
        2. Emotional appeal (1-10)
    
        3. Clarity (1-10)
    
    
    
    
        Copy to evaluate: ${copy}`,
    
      });
    
    
    
    
      // If quality check fails, regenerate with more specific instructions
    
      if (
    
        !qualityMetrics.hasCallToAction ||
    
        qualityMetrics.emotionalAppeal  {
    
          // Each worker is specialized for the type of change
    
          const workerSystemPrompt = {
    
            create:
    
              'You are an expert at implementing new files following best practices and project patterns.',
    
            modify:
    
              'You are an expert at modifying existing code while maintaining consistency and avoiding regressions.',
    
            delete:
    
              'You are an expert at safely removing code while ensuring no breaking changes.',
    
          }[file.changeType];
    
    
    
    
          const { object: change } = await generateObject({
    
            model: 'openai/gpt-4o',
    
            schema: z.object({
    
              explanation: z.string(),
    
              code: z.string(),
    
            }),
    
            system: workerSystemPrompt,
    
            prompt: `Implement the changes for ${file.filePath} to support:
    
            ${file.purpose}
    
    
    
    
            Consider the overall feature context:
    
            ${featureRequest}`,
    
          });
    
    
    
    
          return {
    
            file,
    
            implementation: change,
    
          };
    
        }),
    
      );
    
    
    
    
      return {
    
        plan: implementationPlan,
    
        changes: fileChanges,
    
      };
    
    }

## Evaluator-Optimizer

Add quality control to workflows with dedicated evaluation steps that assess intermediate results. Based on the evaluation, the workflow proceeds, retries with adjusted parameters, or takes corrective action. This creates robust workflows capable of self-improvement and error recovery.
    
    
    import { generateText, generateObject } from 'ai';
    
    import { z } from 'zod';
    
    
    
    
    async function translateWithFeedback(text: string, targetLanguage: string) {
    
      let currentTranslation = '';
    
      let iterations = 0;
    
      const MAX_ITERATIONS = 3;
    
    
    
    
      // Initial translation
    
      const { text: translation } = await generateText({
    
        model: 'openai/gpt-4o-mini', // use small model for first attempt
    
        system: 'You are an expert literary translator.',
    
        prompt: `Translate this text to ${targetLanguage}, preserving tone and cultural nuances:
    
        ${text}`,
    
      });
    
    
    
    
      currentTranslation = translation;
    
    
    
    
      // Evaluation-optimization loop
    
      while (iterations = 8 &&
    
          evaluation.preservesTone &&
    
          evaluation.preservesNuance &&
    
          evaluation.culturallyAccurate
    
        ) {
    
          break;
    
        }
    
    
    
    
        // Generate improved translation based on feedback
    
        const { text: improvedTranslation } = await generateText({
    
          model: 'openai/gpt-4o', // use a larger model
    
          system: 'You are an expert literary translator.',
    
          prompt: `Improve this translation based on the following feedback:
    
          ${evaluation.specificIssues.join('\n')}
    
          ${evaluation.improvementSuggestions.join('\n')}
    
    
    
    
          Original: ${text}
    
          Current Translation: ${currentTranslation}`,
    
        });
    
    
    
    
        currentTranslation = improvedTranslation;
    
        iterations++;
    
      }
    
    
    
    
      return {
    
        finalTranslation: currentTranslation,
    
        iterationsRequired: iterations,
    
      };
    
    }

Previous

Building Agents

Next

Loop Control