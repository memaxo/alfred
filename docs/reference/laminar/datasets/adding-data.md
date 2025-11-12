---
title: Adding data to Laminar datasets - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/datasets/adding-data#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Datasets

Adding data to Laminar datasets

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [1\. Export from a span](https://docs.lmnr.ai/datasets/adding-data#1-export-from-a-span)
- [2\. File upload](https://docs.lmnr.ai/datasets/adding-data#2-file-upload)
- [File format](https://docs.lmnr.ai/datasets/adding-data#file-format)
- [3\. Add manually](https://docs.lmnr.ai/datasets/adding-data#3-add-manually)
- [4\. Enrich using a queue](https://docs.lmnr.ai/datasets/adding-data#4-enrich-using-a-queue)

You can add datapoints either from file or by manually adding datapoints one-by-one.

## [​](https://docs.lmnr.ai/datasets/adding-data\#1-export-from-a-span)  1\. Export from a span

You can export a span as a datapoint from both Traces and Evaluation traces. To do so,
select a span and click “Add to dataset” in the top right corner.Select the dataset you want to export to and click “Add to dataset”.This will fill the `data` field of the datapoint with the input of the span and
the `target` field with the output of the span.![Export span to dataset](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/datasets/export-span.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=0753d1c4731518f8f48e0b88fb7191e1)

## [​](https://docs.lmnr.ai/datasets/adding-data\#2-file-upload)  2\. File upload

You can upload datapoints from a structured file with datapoints.To do that, click “Add from source” at the top of the Datasets page. Then, select in the tab whether you want to upload in a structured or unstructured way.

### [​](https://docs.lmnr.ai/datasets/adding-data\#file-format)  File format

Supported file formats are: `.csv`, `.json`, `.jsonl`. We infer the format based on the file extension.

- csv - **header is required**, default separator and minimal quoting are assumed.
If a row has an empty value or less values than headers, missing values will be filled with empty strings.
- json - the file must contain **one array** of datapoints.
- jsonlines - every line must contain one datapoint.

For each datapoint, we first construct the key-value object, and then parse it according to the following rules:

1. If keys are `"data"`, `"target"`, `"metadata"`, and `"id"`, we place them in the corresponding fields.

   - If we cannot parse `"id"` as UUID, we assign it a new random UUID.
2. Otherwise, all keys and values will go inside `"data"`.

If there is an error parsing the file, no datapoints will be added.
If a single value in the file does not conform to format, it will be silently ignored.

## [​](https://docs.lmnr.ai/datasets/adding-data\#3-add-manually)  3\. Add manually

Click “Add row” at the top of the Datasets page and new empty row will be added.
You can any value as long as it is a valid JSON that contains a `data` field.![Add datapoint](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/datasets/manual-add-dp.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=b637787700383e31e44b024068e298b8)

## [​](https://docs.lmnr.ai/datasets/adding-data\#4-enrich-using-a-queue)  4\. Enrich using a queue

You can create new datapoints by editing existing ones or copying span data using the queues.Humans can then edit the datapoints in the queue and save them to new datapoints either
in the same dataset or in a new one. [Learn more about queues](https://docs.lmnr.ai/queues/quickstart).

[Introduction](https://docs.lmnr.ai/datasets/introduction) [Quickstart](https://docs.lmnr.ai/queues/quickstart)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Export span to dataset](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/datasets/export-span.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=749e8c203c224264728b91994164ead4)

![Add datapoint](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/datasets/manual-add-dp.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=a85ca0acf635f28ec030a0e0bc6b4017)