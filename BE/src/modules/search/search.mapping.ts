export const searchMapping = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    'index.max_ngram_diff': 19,
    analysis: {
      normalizer: { exact_lower: { type: 'custom', filter: ['lowercase'] } },
      tokenizer: {
        event_edge: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 20,
          token_chars: ['letter', 'digit'],
        },
        event_gram: { type: 'ngram', min_gram: 3, max_gram: 12, token_chars: ['letter', 'digit'] },
      },
      analyzer: {
        event_prefix: { type: 'custom', tokenizer: 'event_edge', filter: ['lowercase'] },
        event_substring: { type: 'custom', tokenizer: 'event_gram', filter: ['lowercase'] },
      },
    },
  },
  mappings: {
    dynamic: 'strict',
    _meta: { contract: 'event-search-v1' },
    properties: {
      id: { type: 'keyword' },
      eventId: { type: 'keyword' },
      hash: { type: 'keyword' },
      version: { type: 'keyword' },
      title: {
        type: 'text',
        analyzer: 'english',
        fields: {
          exact: { type: 'keyword', normalizer: 'exact_lower' },
          prefix: { type: 'text', analyzer: 'event_prefix', search_analyzer: 'standard' },
          gram: { type: 'text', analyzer: 'event_substring', search_analyzer: 'standard' },
        },
      },
      organizer: {
        type: 'text',
        analyzer: 'english',
        fields: { prefix: { type: 'text', analyzer: 'event_prefix', search_analyzer: 'standard' } },
      },
      venue: {
        type: 'text',
        analyzer: 'english',
        fields: { prefix: { type: 'text', analyzer: 'event_prefix', search_analyzer: 'standard' } },
      },
      description: { type: 'text', analyzer: 'english' },
      category: { type: 'keyword' },
      city: { type: 'keyword' },
      startsAt: { type: 'date' },
      endsAt: { type: 'date' },
      completion: { type: 'completion', analyzer: 'simple', search_analyzer: 'simple' },
    },
  },
};
export function searchBody(q: string, suggest = false) {
  return {
    _source: ['id', 'hash'],
    size: suggest ? 50 : 500,
    track_total_hits: true,
    sort: [{ _score: 'desc' }, { id: 'asc' }],
    query: {
      bool: {
        filter: [{ range: { endsAt: { gt: 'now' } } }],
        should: [
          { term: { 'title.exact': { value: q.toLowerCase(), boost: 20 } } },
          { match_phrase: { title: { query: q, boost: 10 } } },
          {
            multi_match: {
              query: q,
              fields: ['title^6', 'organizer^3', 'venue^2', 'description'],
              operator: 'and',
              fuzziness: q.length >= 4 ? 'AUTO' : 0,
              prefix_length: 1,
              max_expansions: 25,
            },
          },
          {
            multi_match: {
              query: q,
              fields: ['title.prefix^4', 'organizer.prefix^2', 'venue.prefix'],
              operator: 'and',
            },
          },
          ...(q.length >= 3
            ? [{ match: { 'title.gram': { query: q, boost: 0.5, operator: 'and' } } }]
            : []),
        ],
        minimum_should_match: 1,
      },
    },
    ...(suggest
      ? {
          suggest: {
            events: {
              prefix: q,
              completion: { field: 'completion', size: 30, skip_duplicates: true },
            },
          },
        }
      : {}),
  };
}
