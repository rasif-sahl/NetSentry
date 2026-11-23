import { BadRequestException } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export class PageQuery {
  @IsOptional()
  @Matches(/^(?:[1-9]|[1-9]\d|100)$/)
  limit?: string;

  @IsOptional()
  @Matches(/^[\w-]+$/)
  @MaxLength(200)
  cursor?: string;
}

export class SearchPageQuery extends PageQuery {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export function pageLimit(query: PageQuery) {
  return Number(query.limit ?? 25);
}

export function readCursor(query: PageQuery, timed = false) {
  if (!query.cursor) return null;
  try {
    const value = JSON.parse(
      Buffer.from(query.cursor, 'base64url').toString('utf8'),
    ) as {
      id?: string;
      time?: string;
    } | null;
    if (
      value &&
      typeof value.id === 'string' &&
      /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value.id) &&
      (timed
        ? typeof value.time === 'string' &&
          /^-?\d{1,15}(?:\.\d{1,6})?$/.test(value.time)
        : value.time === undefined)
    )
      return { id: value.id, time: value.time };
  } catch {
    // An unreadable cursor is handled as a validation error.
  }
  throw new BadRequestException('Invalid page cursor.');
}

export function pageResult<T>(
  rows: T[],
  query: PageQuery,
  key: (item: T, index: number) => { id: string; time?: string },
) {
  const limit = pageLimit(query);
  return {
    items: rows.slice(0, limit),
    nextCursor:
      rows.length > limit
        ? Buffer.from(JSON.stringify(key(rows[limit - 1], limit - 1))).toString(
            'base64url',
          )
        : null,
  };
}

// Timestamp values stay in PostgreSQL precision even when rows hydrate as JS Dates.
export async function selectPage<T extends ObjectLiteral>(
  builder: SelectQueryBuilder<T>,
  query: PageQuery,
  options: { timestamp?: string; id?: string } = {},
) {
  const idName = options.id ?? 'id';
  const id = `${builder.alias}."${idName}"`;
  const time = options.timestamp && `${builder.alias}."${options.timestamp}"`;
  const cursor = readCursor(query, !!time);
  if (time) {
    builder.orderBy(time, 'DESC').addOrderBy(id, 'DESC');
    builder.addSelect(`extract(epoch from ${time})::text`, 'page_time');
    if (cursor) {
      builder.andWhere(
        `(extract(epoch from ${time}), ${id}) < (CAST(:pageTime AS numeric), :pageId)`,
        {
          pageTime: cursor.time,
          pageId: cursor.id,
        },
      );
    }
  } else {
    builder.orderBy(id, 'ASC');
    if (cursor) builder.andWhere(`${id} > :pageId`, { pageId: cursor.id });
  }
  const { entities, raw } = await builder
    .limit(pageLimit(query) + 1)
    .getRawAndEntities();
  return pageResult(entities, query, (row, index) => ({
    id: String(row[idName]),
    ...(time ? { time: String(raw[index].page_time) } : {}),
  }));
}
