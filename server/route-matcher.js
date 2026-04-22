export class RouteMatcher {
  constructor(routes) {
    this.routes = routes.flat()
    this.compiled = this.routes.map(r => ({
      ...r,
      regex: this._pathToRegex(r.path),
    }))
  }

  match(method, pathname) {
    for (const route of this.compiled) {
      if (route.method !== method) continue

      const match = pathname.match(route.regex)
      if (!match) continue

      const params = this._extractParams(route.path, match)
      return { route, params }
    }
    return null
  }

  _pathToRegex(path) {
    const pattern = path
      .replace(/\//g, '\\/')
      .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '([^/]+)')
    return new RegExp(`^${pattern}$`)
  }

  _extractParams(path, match) {
    const names = (path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g) || [])
      .map(n => n.slice(1))
    const values = match.slice(1)
    return Object.fromEntries(names.map((n, i) => [n, values[i]]))
  }
}

export function createRouter(routes) {
  return new RouteMatcher(routes)
}
