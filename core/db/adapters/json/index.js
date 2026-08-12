export async function fetchData(config, databaseConfig) {
  const { data = [] } = databaseConfig;
  const { filters = {}, sorts = [], limit, offset = 0 } = config;

  let results = [...data];

  if (Object.keys(filters).length > 0) {
    results = results.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          if (value.$in) return value.$in.includes(item[key]);
          if (value.$contains) return item[key]?.toLowerCase().includes(value.$contains.toLowerCase());
          if (value.$gt) return item[key] > value.$gt;
          if (value.$lt) return item[key] < value.$lt;
          if (value.$gte) return item[key] >= value.$gte;
          if (value.$lte) return item[key] <= value.$lte;
          if (value.$ne) return item[key] !== value.$ne;
        }
        return item[key] === value;
      });
    });
  }

  if (sorts && sorts.length > 0) {
    results.sort((a, b) => {
      for (const sort of sorts) {
        const { field, direction = 'asc' } = sort;
        const aVal = a[field];
        const bVal = b[field];

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  if (offset) {
    results = results.slice(offset);
  }

  if (limit) {
    results = results.slice(0, limit);
  }

  return results;
}

export async function createData(config, databaseConfig) {
  throw new Error('JSON database is read-only. Cannot create records.');
}

export async function updateData(config, databaseConfig) {
  throw new Error('JSON database is read-only. Cannot update records.');
}

export async function deleteData(config, databaseConfig) {
  throw new Error('JSON database is read-only. Cannot delete records.');
}

export async function searchData(searchTerm, databaseConfig, limit = 10, additionalFilters = {}) {
  const { data = [], schema = {} } = databaseConfig;

  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const searchTermLower = searchTerm.toLowerCase();
  const searchableFields = Object.entries(schema)
    .filter(([_, config]) => config.search === true)
    .map(([name]) => name);

  let results = data.filter(item => {
    const matchesSearch = searchableFields.length > 0
      ? searchableFields.some(field =>
          item[field]?.toString().toLowerCase().includes(searchTermLower)
        )
      : Object.values(item).some(val =>
          val?.toString().toLowerCase().includes(searchTermLower)
        );

    const matchesFilters = Object.entries(additionalFilters).every(([key, value]) =>
      item[key] === value
    );

    return matchesSearch && matchesFilters;
  });

  if (limit) {
    results = results.slice(0, limit);
  }

  return results;
}