// Two traps of the database layer (core/database.js), in one place:
//
// 1. Row ids from fetch() are ObjectIds when fresh from Mongo and strings when served
//    from the query cache. update()/delete() only treat a STRING as an id — anything
//    else is read as an options object and the write silently does nothing.
// 2. update() reports failure in its result ({ success: false }) instead of throwing.

export function idOf(row) {
  return String(row?._id || row?.id || '');
}

export async function updateOrThrow(coll, id, data) {
  const result = await coll.update(String(id), data);
  if (result && result.success === false) {
    throw new Error(`update ${id} failed: ${result.error || 'unknown error'}`);
  }
  return result;
}
