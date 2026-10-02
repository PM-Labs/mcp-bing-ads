import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const tools: Tool[] = [
  {
    name: "bing_ads_get_client_context",
    description: "Get the current client context and health status based on working directory. Call this first to confirm which Bing Ads account you're working with.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        working_directory: {
          type: "string",
          description: "The current working directory",
        },
      },
      required: ["working_directory"],
    },
  },
  {
    name: "bing_ads_list_campaigns",
    description: "List all campaigns for the current client's Bing/Microsoft Advertising account, including campaign name, status, budget, and type.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "The account ID (uses context if not provided)",
        },
      },
    },
  },
  {
    name: "bing_ads_get_campaign_performance",
    description: "Get campaign performance metrics (impressions, clicks, CTR, CPC, spend, conversions, revenue) for a date range.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string" },
        start_date: { type: "string", description: "Start date YYYY-MM-DD" },
        end_date: { type: "string", description: "End date YYYY-MM-DD" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "bing_ads_list_ad_groups",
    description: "List ad groups within a specific campaign, including ad group name and status.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string" },
        campaign_id: { type: "string", description: "The numeric string campaign ID to list ad groups for" },
      },
      required: ["campaign_id"],
    },
  },
  {
    name: "bing_ads_keyword_performance",
    description: "Get keyword performance report with metrics including impressions, clicks, cost, conversions, quality score. Optionally filter by campaign.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string" },
        start_date: { type: "string", description: "Start date YYYY-MM-DD" },
        end_date: { type: "string", description: "End date YYYY-MM-DD" },
        campaign_ids: { type: "array", items: { type: "string" }, description: "Filter by numeric string campaign IDs" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "bing_ads_search_term_report",
    description: "Get search term report showing actual search queries that triggered ads, with matched keywords and performance metrics.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string" },
        start_date: { type: "string", description: "Start date YYYY-MM-DD" },
        end_date: { type: "string", description: "End date YYYY-MM-DD" },
        campaign_ids: { type: "array", items: { type: "string" }, description: "Filter by numeric string campaign IDs" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "bing_ads_pause_keywords",
    description: "Pause one or more keywords by setting their status to Paused. Requires ad group ID and keyword IDs.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account ID (uses context if not provided)" },
        ad_group_id: { type: "string", description: "The ad group containing the keywords" },
        keyword_ids: { type: "array", items: { type: "string" }, description: "Array of keyword IDs to pause" },
      },
      required: ["ad_group_id", "keyword_ids"],
    },
  },
  {
    name: "bing_ads_list_shared_entities",
    description: "List shared negative keyword lists (SharedEntity type) for the account. Returns list IDs and names needed for adding negatives.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account ID (uses context if not provided)" },
        entity_type: { type: "string", description: "Entity type, defaults to NegativeKeywordList", default: "NegativeKeywordList" },
      },
    },
  },
  {
    name: "bing_ads_add_shared_negatives",
    description: "Add negative keywords to a shared negative keyword list. Use phrase match by default (wrap in quotes). Call bing_ads_list_shared_entities first to get list IDs.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account ID (uses context if not provided)" },
        shared_list_id: { type: "string", description: "The shared negative keyword list ID to add negatives to" },
        keywords: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "The negative keyword text" },
              match_type: { type: "string", enum: ["Exact", "Phrase"], description: "Match type (default: Phrase)" },
            },
            required: ["text"],
          },
          description: "Array of negative keywords to add",
        },
      },
      required: ["shared_list_id", "keywords"],
    },
  },
  {
    name: "bing_ads_update_campaign_budget",
    description: "Update a campaign's daily budget amount. Use bing_ads_list_campaigns first to get the campaign ID and current budget.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account ID (uses context if not provided)" },
        campaign_id: { type: "string", description: "The numeric string campaign ID to update" },
        daily_budget: { type: "number", description: "New daily budget in dollars (e.g. 50.00 for $50/day)" },
      },
      required: ["campaign_id", "daily_budget"],
    },
  },
  {
    name: "bing_ads_list_accounts",
    description: "List or search accounts under the Pathfinder manager account (MCC), including linked accounts such as sales prospects. Use this to discover an account_id by business name when no client repo exists yet.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        name_filter: {
          type: "string",
          description: "Case-insensitive substring match against the account name. Omit or pass an empty string to return every account under the manager account.",
        },
        account_id: {
          type: "string",
          description: "Exact account ID to look up. Takes precedence over name_filter if both are supplied.",
        },
      },
    },
  },
  {
    name: "bing_ads_list_conversion_goals",
    description: "List the conversion goals configured for an account (e.g. Purchase, Submit Lead Form, Phone Call): name, type, category, status, plus scope, count type, tag, window, revenue and the match rule (URL, event action/category/label/value, duration, pages) where they apply. Deleted goals are not listed. Use this to discover goal names before interpreting bing_ads_conversion_performance's by_goal breakdown.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account ID (uses context if not provided)" },
      },
    },
  },
  {
    name: "bing_ads_conversion_performance",
    description: "Get conversion performance (qualified conversions, conversion rate, cost per conversion, revenue, ROAS) per campaign for a date range, using Microsoft's current non-deprecated conversion columns. Set by_goal to true to break results out by conversion goal (returns one row per campaign per goal instead of one aggregate row per campaign). Not applicable to Shopping campaigns.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string" },
        start_date: { type: "string", description: "Start date YYYY-MM-DD" },
        end_date: { type: "string", description: "End date YYYY-MM-DD" },
        campaign_ids: { type: "array", items: { type: "string" }, description: "Filter by numeric string campaign IDs" },
        by_goal: { type: "boolean", description: "If true, break results out per conversion goal (multiple rows per campaign). Defaults to false (one aggregate row per campaign)." },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "bing_ads_list_uet_tags",
    description: "List the UET (Universal Event Tracking) tags available to an account: id, name, description, status and owner customer. Tags are shared at customer level, so this shows every tag the account can use. Use it to find the tag_id needed by bing_ads_create_conversion_goal. The tracking script is only returned when a tag is created.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account ID (uses context if not provided)" },
      },
    },
  },
  {
    name: "bing_ads_create_uet_tag",
    description: "Create a UET tracking tag. Returns the new tag's id and the tracking script to install on the website. WRITE: tags can never be deleted or removed, only renamed in the Microsoft Ads UI, and they are shared across the whole customer, so only create one when a site genuinely has no tag yet (check bing_ads_list_uet_tags first; one tag can serve all of an account's goals).",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account ID (uses context if not provided)" },
        name: { type: "string", description: "Tag name, 1-100 characters" },
        description: { type: "string", description: "Optional description" },
      },
      required: ["name"],
    },
  },
  {
    name: "bing_ads_create_conversion_goal",
    description: "Create a conversion goal on an account. goal_type: Url (a page visit, e.g. a thank-you page), Event (a custom UET event such as a form submit), Duration (time on site), PagesViewedPerVisit. Needs a tag_id from bing_ads_list_uet_tags. Defaults to Account scope (only this account) unlike Microsoft's own default of Customer scope. Returns the goal as read back from Microsoft. WRITE, and it can change more than the goal: creating a goal can switch on Microsoft's auto-tagging (MSCLKID) for the WHOLE account, i.e. its existing campaigns too (for a Customer-scope goal, every account under the customer). Check that is acceptable before using this on a client account. The goal also starts tracking immediately.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account ID (uses context if not provided)" },
        goal_type: { type: "string", enum: ["Url", "Event", "Duration", "PagesViewedPerVisit"] },
        name: { type: "string", description: "Goal name, 1-100 characters, unique across the whole customer" },
        goal_category: { type: "string", enum: ["Purchase", "AddToCart", "BeginCheckout", "Subscribe", "SubmitLeadForm", "BookAppointment", "Signup", "RequestQuote", "GetDirections", "OutboundClick", "Contact", "PageView", "Download", "Other"], description: "Required by Microsoft" },
        tag_id: { type: "string", description: "Numeric UET tag ID (from bing_ads_list_uet_tags)" },
        scope: { type: "string", enum: ["Account", "Customer"], description: "Account (default) = this account only. Customer = every account under the customer. Cannot be changed later." },
        count_type: { type: "string", enum: ["All", "Unique"], description: "Unique = one conversion per click (typical for leads); All = every conversion (typical for sales). Microsoft default: All." },
        conversion_window_minutes: { type: "number", description: "1-129600 (90 days). Microsoft default 43200 (30 days)." },
        exclude_from_bidding: { type: "boolean", description: "True = do not count this goal in 'Conversions' or automated bidding" },
        revenue_type: { type: "string", enum: ["NoValue", "FixedValue", "VariableValue"], description: "Not allowed on Duration or PagesViewedPerVisit goals" },
        revenue_value: { type: "number", description: "Required for FixedValue; optional default for VariableValue; not allowed for NoValue" },
        revenue_currency: { type: "string", description: "Optional currency code; defaults to the account currency for Account-scope goals" },
        url_expression: { type: "string", description: "Url goal: the page URL (or part of it) that counts as a conversion" },
        url_operator: { type: "string", enum: ["Equals", "Contains", "BeginsWith", "EndsWith", "RegularExpression"], description: "Url goal; default Equals" },
        action_expression: { type: "string", description: "Event goal: the UET event action to match" },
        action_operator: { type: "string", enum: ["Equals", "Contains", "BeginsWith", "EndsWith", "RegularExpression"] },
        category_expression: { type: "string", description: "Event goal: the UET event category to match" },
        category_operator: { type: "string", enum: ["Equals", "Contains", "BeginsWith", "EndsWith", "RegularExpression"] },
        label_expression: { type: "string", description: "Event goal: the UET event label to match" },
        label_operator: { type: "string", enum: ["Equals", "Contains", "BeginsWith", "EndsWith", "RegularExpression"] },
        event_value: { type: "number", description: "Event goal: numeric event value to match" },
        event_value_operator: { type: "string", enum: ["Equals", "GreaterThan", "LessThan"] },
        minimum_duration_seconds: { type: "number", description: "Duration goal: minimum visit length in seconds" },
        minimum_pages_viewed: { type: "number", description: "PagesViewedPerVisit goal: minimum pages in a visit" },
      },
      required: ["goal_type", "name", "goal_category", "tag_id"],
    },
  },
  {
    name: "bing_ads_update_conversion_goal",
    description: "Edit or pause a Url, Event, Duration or PagesViewedPerVisit conversion goal. Only the fields you pass change; the rest (including an Event goal's match rule) are kept. To retire a goal set status Paused (reversible with Active): Microsoft does not allow deleting goals through the API, so a paused goal stays in the list. Scope and goal type cannot be changed. Returns the goal as read back from Microsoft. WRITE.",
    inputSchema: {
      additionalProperties: false,
      type: "object",
      properties: {
        account_id: { type: "string", description: "The account ID (uses context if not provided)" },
        goal_id: { type: "string", description: "Numeric goal ID (from bing_ads_list_conversion_goals)" },
        name: { type: "string", description: "New name, 1-100 characters" },
        status: { type: "string", enum: ["Active", "Paused"], description: "Paused retires a goal (it stops tracking and stays visible). Microsoft does not allow deleting a goal through the API." },
        goal_category: { type: "string", enum: ["Purchase", "AddToCart", "BeginCheckout", "Subscribe", "SubmitLeadForm", "BookAppointment", "Signup", "RequestQuote", "GetDirections", "OutboundClick", "Contact", "PageView", "Download", "Other"] },
        count_type: { type: "string", enum: ["All", "Unique"] },
        conversion_window_minutes: { type: "number", description: "1-129600" },
        exclude_from_bidding: { type: "boolean" },
        revenue_type: { type: "string", enum: ["NoValue", "FixedValue", "VariableValue"] },
        revenue_value: { type: "number" },
        revenue_currency: { type: "string" },
        url_expression: { type: "string" },
        url_operator: { type: "string", enum: ["Equals", "Contains", "BeginsWith", "EndsWith", "RegularExpression"] },
        action_expression: { type: "string" },
        action_operator: { type: "string", enum: ["Equals", "Contains", "BeginsWith", "EndsWith", "RegularExpression"] },
        category_expression: { type: "string" },
        category_operator: { type: "string", enum: ["Equals", "Contains", "BeginsWith", "EndsWith", "RegularExpression"] },
        label_expression: { type: "string" },
        label_operator: { type: "string", enum: ["Equals", "Contains", "BeginsWith", "EndsWith", "RegularExpression"] },
        event_value: { type: "number" },
        event_value_operator: { type: "string", enum: ["Equals", "GreaterThan", "LessThan"] },
        minimum_duration_seconds: { type: "number" },
        minimum_pages_viewed: { type: "number" },
      },
      required: ["goal_id"],
    },
  },
];
