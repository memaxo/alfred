---
title: Custom Dashboards - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/custom-dashboards/overview#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Custom Dashboards

Custom Dashboards

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [What you can do](https://docs.lmnr.ai/custom-dashboards/overview#what-you-can-do)
- [Getting Started](https://docs.lmnr.ai/custom-dashboards/overview#getting-started)
- [Query](https://docs.lmnr.ai/custom-dashboards/overview#query)
- [Parameters](https://docs.lmnr.ai/custom-dashboards/overview#parameters)
- [Chart Settings](https://docs.lmnr.ai/custom-dashboards/overview#chart-settings)
- [Export to Dashboard](https://docs.lmnr.ai/custom-dashboards/overview#export-to-dashboard)
- [Customizing Charts](https://docs.lmnr.ai/custom-dashboards/overview#customizing-charts)
- [More Examples](https://docs.lmnr.ai/custom-dashboards/overview#more-examples)
- [Trace average duration over time](https://docs.lmnr.ai/custom-dashboards/overview#trace-average-duration-over-time)
- [Total tokens over time](https://docs.lmnr.ai/custom-dashboards/overview#total-tokens-over-time)
- [Learn More](https://docs.lmnr.ai/custom-dashboards/overview#learn-more)

Laminar Dashboards let you track key metrics and build visualizations from your trace, evaluation, and other data on the platform using SQL.
Each project has pre-built dashboards that track key LLM metrics for your project. You can also create your own custom dashboards by writing custom SQL queries.

## [​](https://docs.lmnr.ai/custom-dashboards/overview#what-you-can-do) What you can do

- Query your trace, evaluation, and other data using SQL
- Resize and rearrange charts as you want
- Add parameters to make charts interactive

![Laminar Custom Dashboard Introduction](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/introduction.gif?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=7b8a2cf8fe2df29b18a6182368223a6b)

## [​](https://docs.lmnr.ai/custom-dashboards/overview#getting-started) Getting Started

The Chart Builder workflow consists of the following steps:

1. **Query**: Write Clickhouse SQL queries to retrieve your data
2. **Configure Parameters** (optional): Set up dynamic parameters (start and end date, interval unit, etc.) for interactivity
3. **Query Data**: Execute query to get data
4. **Build Chart**: Configure chart type and visualization settings
5. **Export to Dashboard**: Save your chart and add it to a dashboard

![Chart Builder overview](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/chart-builder-example.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=386093e2d38ac9886552d39fed81bc36)

## [​](https://docs.lmnr.ai/custom-dashboards/overview#query) Query

Start by writing a Clickhouse SQL query that returns the data you want to visualize.
Here is an example query that returns the number of traces created over the last 30 days grouped by day:

Copy

```
SELECT
    -- Convert timestamp to start of day for daily grouping
    toStartOfDay(created_at) as date,
    COUNT(*) as total_traces
FROM traces
WHERE created_at >= now() - INTERVAL 30 DAY
GROUP BY date
ORDER BY date

```

## [​](https://docs.lmnr.ai/custom-dashboards/overview#parameters) Parameters

To make your chart interactive with dashboard controls, you can configure these in `Parameters` tab:

- `{start_time: DateTime64}` \- Start date from the date range picker
- `{end_time: DateTime64}` \- End date from the date range picker
- `{interval_unit: String}` \- Grouping interval ( `HOUR`, `DAY`, `WEEK`, `MONTH`)

![chart-builder-parameters](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/chart-builder-parameters.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=7b9e0b98b6f2fd47754bee6ca2c13777)

Example query with parameters:

Copy

```
SELECT
    toStartOfInterval(created_at, toInterval(1, {interval_unit: String})) as time_bucket,
    COUNT(*) as count,
    AVG(duration_ms) as avg_duration
FROM traces
WHERE created_at >= {start_time: DateTime64}
    AND created_at <= {end_time: DateTime64}
GROUP BY time_bucket
ORDER BY time_bucket

```

By default, if you save query of the chart with parameters, chart will be sensitive to built-in filters on dashboard page.
This can be useful if you want to see your query over different periods of time, or groupings.

![dashboard-parameters](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/dashboard-parameters.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=3f935b900e6536d320fe7616617030a8)

## [​](https://docs.lmnr.ai/custom-dashboards/overview#chart-settings) Chart Settings

- Ensure you run your query to retrieve the data before configuring your chart.

![chart-builder-settings](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/chart-builder-settings.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=5ad71a525c015ec290a381bdc452dee3)

Only Line Charts support multiple metrics visualization, using `Break down lines by` option. If you need to display multiple metrics,
use a Line Chart or create separate charts for each metric.

## [​](https://docs.lmnr.ai/custom-dashboards/overview#export-to-dashboard) Export to Dashboard

- Once you’ve configured your chart, export it with a name to add it to your dashboard.

![chart-builder-export](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/chart-builder-export.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=6e3552e18d07cfc9f1d9a5b999656ec9)

## [​](https://docs.lmnr.ai/custom-dashboards/overview#customizing-charts) Customizing Charts

After adding your chart to the dashboard, you can resize it to fit your layout needs. Simply click and drag the corners or edges of the chart to adjust its dimensions.

![Resizing charts on dashboard](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/chart-builder-resize.gif?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=920250ef6abdb2e4ceabf0e3db8b3bff)

## [​](https://docs.lmnr.ai/custom-dashboards/overview#more-examples) More Examples

#### [​](https://docs.lmnr.ai/custom-dashboards/overview#trace-average-duration-over-time) Trace average duration over time

Copy

```
SELECT
    -- Round start_time to the beginning of the specified interval (MINUTE, HOUR, DAY, WEEK, MONTH)
    toStartOfInterval(start_time, toInterval(1, {interval_unit:String})) AS time,
    -- Calculate average duration for each time bucket, defaulting to 0 if no data
    toFloat64(COALESCE(AVG(duration), 0)) AS value
FROM traces
WHERE
    -- Filter traces within the specified time range
    start_time >= {start_time:DateTime64}
  AND start_time <= {end_time:DateTime64}
GROUP BY time
ORDER BY time
-- Fill gaps in time series with zero values for missing intervals
WITH FILL
FROM toStartOfInterval({start_time:DateTime64}, toInterval(1, {interval_unit:String}))
    TO toStartOfInterval({end_time:DateTime64}, toInterval(1, {interval_unit:String}))
    STEP toInterval(1, {interval_unit:String})

```

#### [​](https://docs.lmnr.ai/custom-dashboards/overview#total-tokens-over-time) Total tokens over time

Copy

```
SELECT
    -- Round start_time to the beginning of the specified interval (MINUTE, HOUR, DAY, WEEK, MONTH)
    toStartOfInterval(start_time, toInterval(1, {interval_unit:String})) AS time,
    -- Sum total tokens consumed across all LLM spans in each time bucket
    sum(total_tokens) AS value
FROM spans
WHERE
    -- Filter for LLM spans only (span_type = 1 indicates LLM calls)
    span_type = 1
  -- Filter spans within the specified time range
  AND start_time >= {start_time:DateTime64}
  AND start_time <= {end_time:DateTime64}
GROUP BY time
ORDER BY time
-- Fill gaps in time series with zero values for missing intervals
WITH FILL
FROM toStartOfInterval({start_time:DateTime64}, toInterval(1, {interval_unit:String}))
    TO toStartOfInterval({end_time:DateTime64}, toInterval(1, {interval_unit:String}))
    STEP toInterval(1, {interval_unit:String})

```

## [​](https://docs.lmnr.ai/custom-dashboards/overview#learn-more) Learn More

For more advanced SQL capabilities, syntax references, and examples, check out the [SQL Editor documentation](https://docs.lmnr.ai/sql-editor/introduction).

[Table schemas](https://docs.lmnr.ai/sql-editor/reference) [Introduction](https://docs.lmnr.ai/datasets/introduction)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Chart Builder overview](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/chart-builder-example.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=5004e2f4df59cce018613231716dc7c0)

![chart-builder-parameters](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/chart-builder-parameters.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=69efbc5797e014a0e279f1f91b25d3cf)

![dashboard-parameters](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/dashboard-parameters.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=696880389381e2a6f544b2f339de873e)

![chart-builder-settings](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/chart-builder-settings.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=53f95e3d1a9efb2bcbdffdb62485b748)

![chart-builder-export](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/custom-dashboard/chart-builder-export.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=97f864175c349c7fd4e243f2a394fccd)
