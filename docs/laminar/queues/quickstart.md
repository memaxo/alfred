---
title: Labeling Queues - Laminar documentation
url: 
description: Labeling queues are a way to quickly label and build datasets for evaluations from span data and other datasets.
language: en
---
[Skip to main content](https://docs.lmnr.ai/queues/quickstart#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Labeling Queues

Labeling Queues

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [What is a Labeling Queue?](https://docs.lmnr.ai/queues/quickstart#what-is-a-labeling-queue%3F)
- [How to Use the Labeling Interface](https://docs.lmnr.ai/queues/quickstart#how-to-use-the-labeling-interface)
- [Payload view](https://docs.lmnr.ai/queues/quickstart#payload-view)
- [Target Editor](https://docs.lmnr.ai/queues/quickstart#target-editor)
- [Save Preferences](https://docs.lmnr.ai/queues/quickstart#save-preferences)
- [Navigation](https://docs.lmnr.ai/queues/quickstart#navigation)
- [Push items to the queue](https://docs.lmnr.ai/queues/quickstart#push-items-to-the-queue)
- [From Span View](https://docs.lmnr.ai/queues/quickstart#from-span-view)
- [From Dataset View](https://docs.lmnr.ai/queues/quickstart#from-dataset-view)

## [​](https://docs.lmnr.ai/queues/quickstart\#what-is-a-labeling-queue%3F)  What is a Labeling Queue?

- A labeling queue is a collection of items that need to be labeled.
- Labeling queue is an actual queue with FIFO (first in, first out) order.
- Items in the queue have exactly the same shape as datapoints in a dataset.
- Labeling operation in this context means writing a data to the target field of a datapoint.

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/queues/lq-view.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=7253ba02d4df13965f44d8d90c405ffb)

## [​](https://docs.lmnr.ai/queues/quickstart\#how-to-use-the-labeling-interface)  How to Use the Labeling Interface

When you open a labeling queue, you’ll see a split-screen interface designed for efficient labeling:

### [​](https://docs.lmnr.ai/queues/quickstart\#payload-view)  Payload view

The left panel shows you the full JSON payload of the current item you’re labeling.
Payload is a JSON object with the same shape as a datapoint in a dataset. It has `data` and `target` fields.

### [​](https://docs.lmnr.ai/queues/quickstart\#target-editor)  Target Editor

This is where you do the actual labeling work:

- **Edit the JSON in the target editor** to correct, improve, or write new data to the target field.
- **Use proper JSON formatting** \- the editor will help you with syntax highlighting

As you type in the target editor on the right, watch how the `"target"` section in the left payload updates in real-time. This helps you see exactly what will be saved to your dataset.

### [​](https://docs.lmnr.ai/queues/quickstart\#save-preferences)  Save Preferences

- **Select your target dataset** from the dropdown to choose where completed items should go
- **Click “Complete”** to save the current item to the dataset and move to the next item in the queue.

### [​](https://docs.lmnr.ai/queues/quickstart\#navigation)  Navigation

- **Check the item counter** (“Item 5 of 11”) to see how many items you’ve completed and how many remain
- **Use the navigation buttons** to move through your queue:

  - Click **“Skip”** if you want to pass on the current item without making changes
  - Use **“Prev”** and **“Next”** to move between items (helpful for comparing similar cases)
  - Click **“Complete”** when you’re satisfied with your labeling

## [​](https://docs.lmnr.ai/queues/quickstart\#push-items-to-the-queue)  Push items to the queue

### [​](https://docs.lmnr.ai/queues/quickstart\#from-span-view)  From Span View

You can push individual spans directly to a labeling queue for labeling.
This is particularly useful when you want to label specific model outputs for evaluation.
Span input will be added to the `data` field of the datapoint, and span output will be added to the `target` field.

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/queues/push-from-span.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=747b1f2e81d45cda1c691f7dda155785)

### [​](https://docs.lmnr.ai/queues/quickstart\#from-dataset-view)  From Dataset View

You can also push existing datapoints from datasets into a labeling queue.
You can either push individual datapoint or select a subset of datapoints in the dataset view.

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/queues/push-from-datapoint.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=71673f34f20c31affe1434e51a73ed35)

When pushing items to a queue, they maintain the same JSON structure as datapoints in datasets, ensuring consistency between your labeling workflow and final datasets.

[Adding data](https://docs.lmnr.ai/datasets/adding-data) [Introduction](https://docs.lmnr.ai/playground/introduction)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/queues/lq-view.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=e041b8ff4015ee2b95df4933a766517c)

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/queues/push-from-span.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=91455d5ba4da35a5a1d102f03571939d)

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/queues/push-from-datapoint.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=b2d5d55cceb3dcab4b004d88fa816d70)