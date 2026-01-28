// Internal representation for parsed Scheme code.
// Scheme code consists of expressions, which are recursively defined as either "atoms"
// or lists of expressions. Lists are represented in the conventional Scheme notation
// of nested cons cells (Pair objects).

// Classes for expression objects
export class Pair {
  /**
   * Represents a Scheme pair ("cons cell").
   * 'first' and 'second' are publicly accessible attributes.
   * Scheme idiomatic accessors can be implemented as follows, given that p is a Pair:
   * car     ==> p.first
   * cdr     ==> p.second
   * cadr    ==> p.second.first
   * caadr   ==> p.second.first.first
   * ... etc.
   * Note that if any of these actions is semantically invalid, a JavaScript error will be thrown.
   */
  constructor(first, second) {
    this.first = first
    this.second = second
  }

  equals(other) {
    if (other instanceof Pair) {
      return this.first.equals(other.first) && this.second.equals(other.second)
    }
    return false
  }
}

export class NumberNode {
  constructor(value) {
    this.value = value
  }

  toString() {
    return String(this.value)
  }

  equals(other) {
    if (other instanceof NumberNode) {
      return this.value === other.value
    }
    return this.value === other
  }
}

export class SymbolNode {
  constructor(value) {
    this.value = value
  }

  toString() {
    return this.value
  }

  equals(other) {
    if (other instanceof SymbolNode) {
      return this.value === other.value
    }
    return this.value === other
  }
}

export class BooleanNode {
  constructor(value) {
    this.value = value
  }

  toString() {
    return this.value ? '#t' : '#f'
  }

  equals(other) {
    if (other instanceof BooleanNode) {
      return this.value === other.value
    }
    return this.value === other
  }
}

// An exception that can be raised by the various functions in this module when
// there's an error with the Scheme expressions they're asked to process.
export class ExprError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ExprError'
  }
}

function exprRepr(expr) {
  /**
   * A textual representation of the given Scheme expression.
   */
  function reprRec(obj) {
    if (obj === null) {
      return '()'
    } else if (
      obj instanceof BooleanNode ||
      obj instanceof SymbolNode ||
      obj instanceof NumberNode
    ) {
      return obj.toString()
    } else if (obj instanceof Pair) {
      let str = '(' + reprRec(obj.first)
      let current = obj.second
      while (current instanceof Pair) {
        str += ' ' + reprRec(current.first)
        current = current.second
      }
      if (current !== null) {
        str += ' . ' + reprRec(current) + ')'
      } else {
        str += ')'
      }
      return str
    } else {
      throw new ExprError(`Unexpected type: ${typeof obj}`)
    }
  }
  return reprRec(expr)
}

function makeNestedPairs(...args) {
  /**
   * Given a list of arguments, creates a list in Scheme representation (nested Pairs)
   */
  if (args.length === 0) {
    return null
  }
  return new Pair(args[0], makeNestedPairs(...args.slice(1)))
}

function* iterPairs(pair) {
  /**
   * Given a list in Scheme representation (nested Pairs), yields its elements in order.
   */
  while (pair instanceof Pair) {
    yield pair.first
    pair = pair.second
  }
}

function* reverseIterPairs(pair) {
  /**
   * Given a list in Scheme representation (nested Pairs), yields its elements in reverse order.
   */
  const stack = []
  while (pair instanceof Pair) {
    stack.push(pair.first)
    pair = pair.second
  }
  while (stack.length > 0) {
    yield stack.pop()
  }
}

function expandNestedPairs(pair, recursive = false) {
  /**
   * Given a list in Scheme representation (nested Pairs), expands it into a JavaScript array.
   * When recursive=true, expands nested pairs as well.
   * I.e Scheme's (1 (2 3) 4) is correctly translated to [1, [2, 3], 4].
   * Ignores dotted-pair endings: (1 2 . 3) will be translated to [1, 2].
   */
  const lst = []
  let current = pair
  while (current instanceof Pair) {
    const head = current.first
    if (recursive && head instanceof Pair) {
      lst.push(expandNestedPairs(head, recursive))
    } else {
      lst.push(head)
    }
    current = current.second
  }
  return lst
}

function isSchemeExpr(exp) {
  /**
   * Check if the given expression is a Scheme expression.
   */
  return (
    exp === null ||
    isSelfEvaluating(exp) ||
    isVariable(exp) ||
    exp instanceof Pair
  )
}

// Dissection of Scheme expressions into their constituents. Roughly follows section 4.1.2 of SICP.

function isPair(exp) {
  return exp instanceof Pair
}

function isSymbol(exp) {
  return exp instanceof SymbolNode
}

function isSelfEvaluating(exp) {
  return exp instanceof NumberNode || exp instanceof BooleanNode
}

function isVariable(exp) {
  return exp instanceof SymbolNode
}

function isTaggedList(exp, tag) {
  /**
   * Is the expression a list starting with the given symbolic tag?
   */
  return exp instanceof Pair && exp.first.equals(tag)
}

function isQuoted(exp) {
  return isTaggedList(exp, new SymbolNode('quote'))
}

function textOfQuotation(exp) {
  return exp.second.first
}

function isAssignment(exp) {
  return isTaggedList(exp, new SymbolNode('set!'))
}

function assignmentVariable(exp) {
  return exp.second.first
}

function assignmentValue(exp) {
  return exp.second.second.first
}

function makeAssignment(variable, value) {
  return makeNestedPairs(new SymbolNode('set!'), variable, value)
}

function isDefinition(exp) {
  return isTaggedList(exp, new SymbolNode('define'))
}

function definitionVariable(exp) {
  if (exp.second.first instanceof SymbolNode) {
    return exp.second.first
  } else {
    return exp.second.first.first
  }
}

function definitionValue(exp) {
  if (exp.second.first instanceof SymbolNode) {
    return exp.second.second.first
  } else {
    return makeLambda(exp.second.first.second, exp.second.second)
  }
}

function isLambda(exp) {
  return isTaggedList(exp, new SymbolNode('lambda'))
}

function lambdaParameters(exp) {
  return exp.second.first
}

function lambdaBody(exp) {
  return exp.second.second
}

function makeLambda(parameters, body) {
  return new Pair(new SymbolNode('lambda'), new Pair(parameters, body))
}

function isIf(exp) {
  return isTaggedList(exp, new SymbolNode('if'))
}

function ifPredicate(exp) {
  return exp.second.first
}

function ifConsequent(exp) {
  return exp.second.second.first
}

function ifAlternative(exp) {
  const alterExp = exp.second.second.second
  if (alterExp === null) {
    return new BooleanNode(false)
  } else {
    return alterExp.first
  }
}

function makeIf(predicate, consequent, alternative) {
  return makeNestedPairs(
    new SymbolNode('if'),
    predicate,
    consequent,
    alternative
  )
}

function isBegin(exp) {
  return isTaggedList(exp, new SymbolNode('begin'))
}

function beginActions(exp) {
  return exp.second
}

function isLastExp(seq) {
  return seq.second === null
}

function firstExp(seq) {
  return seq.first
}

function restExps(seq) {
  return seq.second
}

// Procedure applications
function isApplication(exp) {
  return exp instanceof Pair
}

function applicationOperator(exp) {
  return exp.first
}

function applicationOperands(exp) {
  return exp.second
}

function hasNoOperands(ops) {
  return ops === null
}

function firstOperand(ops) {
  return ops.first
}

function restOperands(ops) {
  return ops.second
}

function sequenceToExp(seq) {
  /**
   * Convert a sequence of expressions to a single expression, adding 'begin' if required.
   */
  if (seq === null) {
    return null
  } else if (isLastExp(seq)) {
    return firstExp(seq)
  } else {
    return new Pair(new SymbolNode('begin'), seq)
  }
}

// 'cond' is a derived expression and is expanded into a series of nested 'if's.
function isCond(exp) {
  return isTaggedList(exp, new SymbolNode('cond'))
}

function condClauses(exp) {
  return exp.second
}

function condPredicate(clause) {
  return clause.first
}

function condActions(clause) {
  return clause.second
}

function isCondElseClause(clause) {
  return condPredicate(clause).equals(new SymbolNode('else'))
}

function convertCondToIfs(exp) {
  return expandCondClauses(condClauses(exp))
}

function expandCondClauses(clauses) {
  if (clauses === null) {
    return new BooleanNode(false)
  }

  const first = clauses.first
  const rest = clauses.second

  if (isCondElseClause(first)) {
    if (rest === null) {
      return sequenceToExp(condActions(first))
    } else {
      throw new ExprError(`ELSE clause is not last: ${exprRepr(clauses)}`)
    }
  } else {
    return makeIf(
      (predicate = condPredicate(first)),
      (consequent = sequenceToExp(condActions(first))),
      (alternative = expandCondClauses(rest))
    )
  }
}

// 'let' is a derived expression:
function isLet(exp) {
  return isTaggedList(exp, new SymbolNode('let'))
}

function letBindings(exp) {
  return exp.second.first
}

function letBody(exp) {
  return exp.second.second
}

function convertLetToApplication(exp) {
  /**
   * Given a Scheme 'let' expression converts it to the appropriate application of an anonymous procedure.
   */
  const bindings = letBindings(exp)
  const vars = []
  const vals = []

  let current = bindings
  while (current !== null) {
    vars.push(current.first.first)
    vals.push(current.first.second.first)
    current = current.second
  }

  const lambdaExpr = makeLambda(makeNestedPairs(...vars), letBody(exp))
  return makeNestedPairs(lambdaExpr, ...vals)
}

const compilerHelpers = `
(func $is_false (param $v (ref null eq)) (result i32)
    ;; if it's not a BOOL at all, it's truthy
    (ref.test (ref $BOOL) (local.get $v))
    (if (result i32)
        (then
            ;; it's a BOOL, check its value
            (i32.eqz (struct.get $BOOL 0 (ref.cast (ref $BOOL) (local.get $v))))
        )
        (else
            (i32.const 0))
    )
)
`

const imports = `
(import "env" "write_char" (func $write_char (param i32)))
(import "env" "write_i32" (func $write_i32 (param i32)))
`

export class WasmCompiler {
  constructor(stream = '') {
    this.stream = stream
    this.indent = 0
    this.userFuncs = [] // Stores compiled function streams
    this.lexicalEnv = [] // Stack of lexical frames (variable names)
    this.tailcallPos = 0
    this.symbolOffset = 2048
    this.symbolmap = {} // Maps symbol names to memory offsets
  }

  compile(exprList) {
    const nestedList = makeNestedPairs(exprList)
    this.emitModule(nestedList)
  }

  // Expands a block of expressions (e.g., (define x 1) (begin ...)) into a lower-level form.
  expandBlock(exprlist) {
    if (!isPair(exprlist)) {
      return this.expandExpr(exprlist)
    }

    let result = null
    let names = null

    // Iterate over the list in reverse to build a nested BEGIN structure.
    for (const expr of this.reverseIterPairs(exprlist)) {
      const [expandedExpr, defName] = this.expandDefinition(expr)
      if (result === null) {
        result = expandedExpr
      } else {
        result = this.makePair(
          this.makeSymbol('begin'),
          this.makePair(expandedExpr, result)
        )
      }
      if (defName !== null) {
        names = this.makePair(defName, names)
      }
    }

    // No internal definitions? Just return the result.
    if (names === null) {
      return result
    }

    // There are internal definitions. Wrap the result in a lambda.
    let args = null // Empty list of args (for set! values)
    for (const name of this.iterPairs(names)) {
      args = this.makePair(null, args)
    }

    return this.makePair(makeLambda(names, result), args)
  }

  // Expands a single definition or expression.
  expandDefinition(expr) {
    if (this.isDefinition(expr)) {
      const defName = this.definitionVariable(expr)
      const defValue = this.definitionValue(expr)
      const setBang = this.makeAssignment(defName, this.expandExpr(defValue))
      return [setBang, defName]
    }
    return [this.expandExpr(expr), null]
  }

  // Expands a single expression (e.g., lambda, if, set!).
  expandExpr(expr) {
    if (expr === null || isSymbol(expr) || isSelfEvaluating(expr)) {
      return expr
    }

    if (!isPair(expr)) {
      throw new Error(`Unexpected expression: ${expr}`)
    }

    const first = expr.first
    if (isSymbol(first)) {
      switch (first.value) {
        case 'lambda':
          return makeLambda(
            lambdaParameters(expr),
            this.expandBlock(lambdaBody(expr))
          )
        case 'if':
          return this.makeIf(
            this.expandExpr(ifPredicate(expr)),
            this.expandExpr(this.ifConsequent(expr)),
            this.expandExpr(ifAlternative(expr))
          )
        case 'cond':
          return this.expandExpr(this.convertCondToIfs(expr))
        case 'let':
          return this.expandExpr(this.convertLetToApplication(expr))
        case 'begin':
          return this.expandBlock(this.beginActions(expr))
        case 'set!':
          return this.makeAssignment(
            this.assignmentVariable(expr),
            this.expandExpr(this.assignmentValue(expr))
          )
        default:
          return this.expandList(expr)
      }
    }
    throw new Error(`Unexpected expression: ${expr}`)
  }

  // Expands a list recursively.
  expandList(expr) {
    if (expr === null) return null
    if (!this.isPair(expr)) {
      throw new Error(`Expected pair, got ${expr}`)
    }
    return this.makePair(
      this.expandExpr(expr.first),
      this.expandList(expr.second)
    )
  }

  emitModule(expr) {
    this.stream += '(module\n'
    this.indent += 4
    this.emitText(imports)
    this.emitText(builtinTypes)

    // Start a new lexical frame for builtins
    this.lexicalEnv.push([])
    for (const blt of builtins) {
      this.stream += blt.codeTempl.replace(
        /\$\{([^}]+)\}/g,
        (_, key) => blt.codeParams[key] || ''
      )

      this.lexicalEnv[(this.lexicalEnv.length || 1) - 1].unshift(blt.name)
    }

    this.emitText(compilerHelpers)
    this.emitStartFunc()

    // Emit user code
    this.emitProc(expr)

    // Emit all user-defined functions
    for (let i = 0; i < this.userFuncs.length; i++) {
      this.emitLine('')
      this.stream += this.userFuncs[i]
    }

    // Emit table and element section
    this.emitLine('')
    this.emitLine(`(table ${builtins.length + this.userFuncs.length} funcref)`)

    let elemIndex = 0
    for (const blt of builtins) {
      const name = blt.codeParams.NAME || blt.name
      this.emitLine(`(elem (i32.const ${elemIndex}) \$${name})`)
      elemIndex++
    }

    for (let i = 0; i < this.userFuncs.length; i++) {
      this.emitLine(`(elem (i32.const ${elemIndex}) $user_func_${i})`)
      elemIndex++
    }

    // Emit memory and symbols
    this.emitLine('(memory 16)')
    if (Object.keys(this.symbolmap).length > 0) {
      this.emitLine('')
      const sortedSymbols = Object.entries(this.symbolmap).sort(
        (a, b) => a[1] - b[1]
      )
      for (const [sym, offset] of sortedSymbols) {
        this.emitLine(`(data (i32.const ${offset}) "${sym}")`)
      }
    }

    this.indent -= 4
    this.stream += ')'
  }

  emitStartFunc() {
    this.emitLine('')
    this.emitLine('(func (export "start") (result i32)')
    this.indent += 4
    this.emitLine('(local $builtins (ref null eq))')

    // Build the builtins environment frame
    for (let i = 0; i < builtins.length; i++) {
      const blt = builtins[i]
      this.emitLine(`(local.set $builtins (struct.new $PAIR
                (struct.new $CLOSURE (ref.null $ENV) (i32.const ${i}))
                (local.get $builtins)))`)
    }

    this.emitLine('')
    this.emitLine(';; call toplevel user function')
    this.emitLine('(call $user_func_0 (local.get $builtins) (ref.null $ENV))')
    this.emitLine('drop')
    this.emitLine('(i32.const 0)')
    this.indent -= 4
    this.emitLine(')')
  }

  emitProc(expr) {
    // Save current state
    const savedStream = this.stream
    const savedIndent = this.indent
    const savedTailcallPos = this.tailcallPos

    // Create new function stream
    this.stream = ''
    this.indent = 0
    this.tailcallPos = 0

    const funcIdx = this.userFuncs.length

    // Put placeholder so inner functions get new index
    this.userFuncs.push('')

    this.emitLine(
      `(func $user_func_${funcIdx} (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))`
    )
    this.indent += 4
    this.emitLine('(local $clostemp (ref null $CLOSURE))')
    this.emitLine(';; prologue: env = new ENV(env, args)')
    this.emitLine(
      '(local.set $env (struct.new $ENV (local.get $env) (local.get $arg)))'
    )

    // Emit the function's body
    this.emitExpr(expr)

    this.indent -= 4
    this.emitLine(')')

    // Update this user function
    // this.userFuncs.push(this.stream)
    this.userFuncs[funcIdx] = this.stream

    // Restore state
    this.indent = savedIndent
    this.stream = savedStream
    this.tailcallPos = savedTailcallPos

    return funcIdx
  }

  emitExpr(expr) {
    if (expr === null) {
      this.emitLine('(ref.null eq)')
    } else if (isSelfEvaluating(expr)) {
      this.emitConstant(expr)
    } else if (expr instanceof SymbolNode) {
      this.emitVar(expr.value)
      this.emitLine(';; load variable value from its cons cell')
      this.emitLine('(struct.get $PAIR 0 (ref.cast (ref $PAIR)))')
    } else if (isAssignment(expr)) {
      const name = this.assignmentVariable(expr).value
      this.emitLine(`;; set! '${name}' = expression`)
      this.emitVar(name)
      this.emitLine('(ref.cast (ref $PAIR))')
      this.tailcallPos += 1
      this.emitExpr(this.assignmentValue(expr))
      this.tailcallPos -= 1
      this.emitLine('(struct.set $PAIR 0)')
      this.emitLine('(ref.null eq)')
    } else if (isQuoted(expr)) {
      const qval = this.textOfQuotation(expr)
      this.emitConstant(qval)
    } else if (isBegin(expr)) {
      this.emitLine(';; begin')
      this.tailcallPos += 1
      this.emitExpr(this.beginActions(expr).first)
      this.tailcallPos -= 1
      this.emitLine('drop')
      this.emitExpr(this.beginActions(expr).second)
    } else if (isLambda(expr)) {
      this.emitLine(';; lambda expression')
      const frame = lambdaParameters(expr).map((p) => p.value)
      this.lexicalEnv.push(frame)
      const funcIdx = this.emitProc(lambdaBody(expr))
      this.lexicalEnv.pop()

      // Return CLOSURE struct
      const elemIdx = funcIdx + builtins.length
      this.emitLine(
        `(struct.new $CLOSURE (local.get $env) (i32.const ${elemIdx}))`
      )
    } else if (isIf(expr)) {
      this.emitLine(';; ifelse condition')
      this.tailcallPos += 1
      this.emitExpr(ifPredicate(expr))
      this.tailcallPos -= 1
      this.emitLine('call $is_false')
      this.emitLine('if (result (ref null eq))')
      this.indent += 4
      this.emitLine(';; else branch')
      this.emitExpr(ifAlternative(expr))
      this.indent -= 4
      this.emitLine('else')
      this.indent += 4
      this.emitLine(';; then branch')
      this.emitExpr(ifConsequent(expr))
      this.indent -= 4
      this.emitLine('end')
    } else if (isApplication(expr)) {
      this.tailcallPos += 1
      this.emitList(applicationOperands(expr))
      this.emitExpr(applicationOperator(expr))
      this.tailcallPos -= 1
      this.emitLine(';; call function')
      this.emitLine('ref.cast (ref $CLOSURE)')
      this.emitLine('local.tee $clostemp')
      this.emitLine('struct.get $CLOSURE 0 ;; get env')
      this.emitLine('local.get $clostemp')
      this.emitLine('struct.get $CLOSURE 1 ;; get function index')
      this.emitLine(';; stack for call: [args] [env] [func idx]')
      if (this.tailcallPos === 0) {
        this.emitLine('return_call_indirect (type $FUNC)')
      } else {
        this.emitLine('call_indirect (type $FUNC)')
      }
    } else {
      throw new Error(`Unexpected expression ${expr}`)
    }
  }

  emitConstant(expr) {
    if (expr === null) {
      this.emitLine('(ref.null eq)')
    } else if (expr instanceof NumberNode) {
      this.emitLine(`(ref.i31 (i32.const ${expr.value}))`)
    } else if (expr instanceof BooleanNode) {
      this.emitLine(
        expr.value
          ? '(struct.new $BOOL (i32.const 1))'
          : '(struct.new $BOOL (i32.const 0))'
      )
    } else if (expr instanceof SymbolNode) {
      if (!(expr.value in this.symbolmap)) {
        this.symbolmap[expr.value] = this.symbolOffset
        this.symbolOffset += expr.value.length
      }
      const offset = this.symbolmap[expr.value]
      this.emitLine(
        `(struct.new $SYMBOL (i32.const ${offset}) (i32.const ${expr.value.length}))`
      )
    } else if (expr instanceof Pair) {
      this.emitLine(';; cons cell for constant')
      this.emitConstant(expr.first)
      this.emitConstant(expr.second)
      this.emitLine('struct.new $PAIR')
    } else {
      throw new Error(`Unexpected constant type: ${typeof expr}`)
    }
  }

  emitList(lst) {
    if (lst instanceof Pair) {
      this.emitExpr(lst.first)
      this.emitList(lst.second)
      this.emitLine('struct.new $PAIR')
    } else {
      this.emitLine('(ref.null eq)')
    }
  }

  emitVar(name) {
    // Emit code to lookup variable 'name' in the lexical environment
    this.emitLine(`;; lookup variable '${name}' in lexical environment`)
    this.emitLine('local.get $env')

    let frameIndex = this.lexicalEnv.length - 1
    while (frameIndex >= 0) {
      const frame = this.lexicalEnv[frameIndex]
      try {
        const varIndex = frame.indexOf(name)
        // Get list of args from this env frame
        this.emitLine(`;; found in frame, at index ${varIndex}`)
        this.emitLine('struct.get $ENV 1')
        for (let i = 0; i < varIndex; i++) {
          this.emitLine('(struct.get $PAIR 1 (ref.cast (ref $PAIR)))')
        }
        return
      } catch (e) {
        // Not found in this frame; go to parent
        this.emitLine('struct.get $ENV 0 ;; get parent env')
        frameIndex--
      }
    }
    throw new Error(`Variable '${name}' not found in lexical environment`)
  }

  emitLine(line) {
    this.stream += ' '.repeat(this.indent) + line + '\n'
  }

  emitText(text) {
    const lines = text.split('\n')
    for (const line of lines) {
      this.emitLine(line)
    }
  }
}

// Debugging aid: Return a multi-line string representing the tree structure of expr
function exprTreeRepr(expr) {
  const sbuf = []
  function rec(v, indent) {
    const prefix = ' '.repeat(indent)
    if (v === null) {
      sbuf.push(`${prefix}null\n`)
      return
    }

    if (
      typeof v === 'boolean' ||
      typeof v === 'symbol' ||
      typeof v === 'number'
    ) {
      sbuf.push(`${prefix}${JSON.stringify(v)}\n`)
      return
    }

    if (Array.isArray(v) && v.length === 2) {
      // Assuming Pair is represented as [first, second]
      sbuf.push(`${prefix}Pair\n`)
      rec(v[0], indent + 2)
      rec(v[1], indent + 2)
    } else {
      throw new Error(`Unexpected type: ${typeof v}`)
    }
  }

  rec(expr, 0)
  return sbuf.join('')
}

// WebAssembly type definitions
const builtinTypes = `
;; PAIR holds the car and cdr of a cons cell.
(type $PAIR (struct (field (mut (ref null eq))) (field (mut (ref null eq)))))

;; BOOL represents a Scheme boolean. zero -> false, nonzero -> true.
(type $BOOL (struct (field i32)))

;; SYMBOL represents a Scheme symbol. It holds an offset in linear memory
;; and the length of the symbol name.
(type $SYMBOL (struct (field i32) (field i32)))

;; ENV holds a reference to the parent env, and a list of values.
(type $ENV (struct (field (ref null $ENV)) (field (ref null eq))))

;; CLOSURE holds a reference to the environment, and the function index in
;; the function table.
(type $CLOSURE (struct (field (ref null $ENV)) (field i32)))

;; FUNC is the type of a Scheme function
(type $FUNC (func (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))))

;; TOPLEVEL is the top-level function exported to the host.
(type $TOPLEVEL (func (result i32)))
`

// Builtin function registry
class BuiltinFunc {
  constructor(name, idx, codeTempl, codeParams) {
    this.name = name
    this.idx = idx
    this.codeTempl = codeTempl
    this.codeParams = codeParams
  }
}

const builtins = []

function registerBuiltIn(name, codeTempl, codeParams) {
  const idx = builtins.length
  builtins.push(new BuiltinFunc(name, idx, codeTempl, codeParams))
}

// Builtin function code templates
const carCode = `
(func $car
    (param $arg (ref null eq))
    (param $env (ref null $ENV))
    (result (ref null eq))
    (struct.get $PAIR 0 (ref.cast (ref $PAIR) (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg)))))
)
`

const cdrCode = `
(func $cdr
    (param $arg (ref null eq))
    (param $env (ref null $ENV))
    (result (ref null eq))
    (struct.get $PAIR 1 (ref.cast (ref $PAIR) (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg)))))
)
`

const cadrCode = `
(func $cadr
    (param $arg (ref null eq))
    (param $env (ref null $ENV))
    (result (ref null eq))
    (struct.get $PAIR 0 (ref.cast (ref $PAIR) (struct.get $PAIR 1 (ref.cast (ref $PAIR) (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg)))))))
)
`

const caddrCode = `
(func $caddr
    (param $arg (ref null eq))
    (param $env (ref null $ENV))
    (result (ref null eq))
    (struct.get $PAIR 0 (ref.cast (ref $PAIR) (struct.get $PAIR 1 (ref.cast (ref $PAIR) (struct.get $PAIR 1 (ref.cast (ref $PAIR) (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg)))))))))
)
`

const consCode = `
(func $cons (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (struct.new $PAIR
        (struct.get $PAIR 0
            (ref.cast (ref $PAIR) (local.get $arg)))
        (struct.get $PAIR 0
            (ref.cast (ref $PAIR)
                (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $arg))))))
)
`

const listCode = `
(func $list
    (param $arg (ref null eq))
    (param $env (ref null $ENV))
    (result (ref null eq))
    (local.get $arg)
)
`

const setCarCode = `
(func $set-car! (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (struct.set $PAIR 0
        (ref.cast (ref $PAIR)
            (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg))))
        (struct.get $PAIR 0
            (ref.cast (ref $PAIR)
                (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $arg))))))
    (ref.null eq)
)
`

const setCdrCode = `
(func $set-cdr! (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (struct.set $PAIR 1
        (ref.cast (ref $PAIR)
            (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg))))
        (struct.get $PAIR 0
            (ref.cast (ref $PAIR)
                (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $arg))))))
    (ref.null eq)
)
`

const nullpCode = `
(func $null? (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (ref.is_null (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg))))
    if (result (ref null eq))
        (struct.new $BOOL (i32.const 1))
    else
        (struct.new $BOOL (i32.const 0))
    end
)
`

const numberpCode = `
(func $number? (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (ref.test (ref i31) (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg))))
    if (result (ref null eq))
        (struct.new $BOOL (i32.const 1))
    else
        (struct.new $BOOL (i32.const 0))
    end
)
`

const booleanpCode = `
(func $boolean? (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (ref.test (ref $BOOL) (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg))))
    if (result (ref null eq))
        (struct.new $BOOL (i32.const 1))
    else
        (struct.new $BOOL (i32.const 0))
    end
)
`

const pairpCode = `
(func $pair? (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (ref.test (ref $PAIR) (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg))))
    if (result (ref null eq))
        (struct.new $BOOL (i32.const 1))
    else
        (struct.new $BOOL (i32.const 0))
    end
)
`

const zeropCode = `
(func $zero? (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (i31.get_s (ref.cast (ref i31) (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg)))))
    (i32.eqz)
    if (result (ref null eq))
        (struct.new $BOOL (i32.const 1))
    else
        (struct.new $BOOL (i32.const 0))
    end
)
`

const symbolpCode = `
(func $symbol? (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (ref.test (ref $SYMBOL) (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg))))
    if (result (ref null eq))
        (struct.new $BOOL (i32.const 1))
    else
        (struct.new $BOOL (i32.const 0))
    end
)
`

// eqv? semantics for Bobscheme - compare identity for pairs and symbols,
// values for numbers and booleans.
const eqvpCode = `
(func $eqv? (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (local $a (ref null eq))
    (local $b (ref null eq))
    (local.set $a (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg))))
    (local.set $b (struct.get $PAIR 0 (ref.cast (ref $PAIR)
        (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $arg))))))

    ;; Fast path: identical refs (covers same pair/symbol/bool object, and also both null)
    (if (ref.eq (local.get $a) (local.get $b))
        (then (return (struct.new $BOOL (i32.const 1))))
    )

    (if (ref.is_null (local.get $a)) (then (return (struct.new $BOOL (i32.const 0)))))
    (if (ref.is_null (local.get $b)) (then (return (struct.new $BOOL (i32.const 0)))))

    ;; Numbers: i31 value compare
    (if (ref.test (ref i31) (local.get $a))
        (then
            (if (ref.test (ref i31) (local.get $b))
                (then
                    (return
                        (struct.new $BOOL
                            (i32.eq
                                (i31.get_s (ref.cast (ref i31) (local.get $a)))
                                (i31.get_s (ref.cast (ref i31) (local.get $b)))))))
                (else (return (struct.new $BOOL (i32.const 0))))))
    )

    ;; Booleans: compare payload
    (if (ref.test (ref $BOOL) (local.get $a))
        (then
            (if (ref.test (ref $BOOL) (local.get $b))
                (then
                    (return
                        (struct.new $BOOL
                            (i32.eq
                                (struct.get $BOOL 0 (ref.cast (ref $BOOL) (local.get $a)))
                                (struct.get $BOOL 0 (ref.cast (ref $BOOL) (local.get $b)))))))
                (else (return (struct.new $BOOL (i32.const 0))))))
    )

    ;; Symbols: compare address and length
    (if (i32.and
            (ref.test (ref $SYMBOL) (local.get $a))
            (ref.test (ref $SYMBOL) (local.get $b)))
        (then
            (return
                (struct.new $BOOL
                    (i32.and
                        (i32.eq
                            (struct.get $SYMBOL 0 (ref.cast (ref $SYMBOL) (local.get $a)))
                            (struct.get $SYMBOL 0 (ref.cast (ref $SYMBOL) (local.get $b))))
                        (i32.eq
                            (struct.get $SYMBOL 1 (ref.cast (ref $SYMBOL) (local.get $a)))
                            (struct.get $SYMBOL 1 (ref.cast (ref $SYMBOL) (local.get $b)))))))))

    ;; Pairs: eqv? is identity, so since ref.eq was false above, return false
    (struct.new $BOOL (i32.const 0))
)
`

// In Bobscheme, we define eq? as an alias for eqv?
const eqpCode = `
(func $eq? (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (call $eqv? (local.get $arg) (local.get $env))
)
`

const andCode = `
(func $and (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (local $cur (ref null eq))
    (local.set $cur (local.get $arg))
    (loop $loop (block $breakloop
        (br_if $breakloop (ref.is_null (local.get $cur)))
        (if (i32.eqz
                (struct.get $BOOL 0 (ref.cast (ref $BOOL)
                    (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $cur))))))
            (then
                (return (struct.new $BOOL (i32.const 0)))
            )
        )
        (local.set $cur
            (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $cur))))
        br $loop
    ))
    (struct.new $BOOL (i32.const 1))
)
`

const orCode = `
(func $or (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (local $cur (ref null eq))
    (local.set $cur (local.get $arg))
    (loop $loop (block $breakloop
        (br_if $breakloop (ref.is_null (local.get $cur)))
        (if (i32.ne
                (struct.get $BOOL 0 (ref.cast (ref $BOOL)
                    (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $cur)))))
                (i32.const 0))
            (then
                (return (struct.new $BOOL (i32.const 1)))
            )
        )
        (local.set $cur
            (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $cur))))
        br $loop
    ))
    (struct.new $BOOL (i32.const 0))
)
`

// 'write' is the trickiest builtin because we have to implement pretty-printing
// of Scheme values in WAT, and it has to match the format of exprRepr exactly,
// because this is what the test suite expects.
// Since WASM GC objects are opaque to the host, we can't be relying on the
// host too much here, and end up only using the basic writeChar and write_i32
// imports.
const writeCode = `
;; The emit* functions use the imported write_char and write_i32 host functions.
(func $emit (param $c i32)
    (call $write_char (local.get $c))
)

(func $emit_lparen  (call $emit (i32.const 40))) ;; '('
(func $emit_rparen  (call $emit (i32.const 41))) ;; ')'
(func $emit_space   (call $emit (i32.const 32))) ;; ' '
(func $emit_newline (call $emit (i32.const 10))) ;; '\\n'

(func $emit_bool (param $b (ref $BOOL))
    (call $emit (i32.const 35)) ;; '#'
    (if (i32.eqz (struct.get $BOOL 0 (local.get $b)))
        (then (call $emit (i32.const 102))) ;; 'f'
        (else (call $emit (i32.const 116))) ;; 't'
    )
)

(func $emit_symbol (param $s (ref $SYMBOL))
    (local $addr i32)
    (local $len i32)
    (local $i i32)
    (local.set $addr (struct.get $SYMBOL 0 (local.get $s)))
    (local.set $len  (struct.get $SYMBOL 1 (local.get $s)))

    (local.set $i (i32.const 0))
    (loop $loop (block $breakloop
        (br_if $breakloop (i32.ge_u (local.get $i) (local.get $len)))
        (call $emit
            (i32.load8_u
                (i32.add
                    (local.get $addr)
                    (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        br $loop
    ))
)

(func $emit_value (param $v (ref null eq))
    ;; nil
    (if (ref.is_null (local.get $v))
        (then
            (call $emit_lparen)
            (call $emit_rparen)
            (return)
        )
    )

    ;; integer
    (if (ref.test (ref i31) (local.get $v))
        (then
            (call $write_i32 (i31.get_s (ref.cast (ref i31) (local.get $v))))
            (return)
        )
    )

    ;; bool
    (if (ref.test (ref $BOOL) (local.get $v))
        (then
            (call $emit_bool (ref.cast (ref $BOOL) (local.get $v)))
            (return)
        )
    )

    ;; symbol
    (if (ref.test (ref $SYMBOL) (local.get $v))
        (then
            (call $emit_symbol (ref.cast (ref $SYMBOL) (local.get $v)))
            (return)
        )
    )

    ;; pair
    (if (ref.test (ref $PAIR) (local.get $v))
        (then
            (call $emit_pair (ref.cast (ref $PAIR) (local.get $v)))
            (return)
        )
    )

    ;; unknown type: emit '?'
    (call $emit (i32.const 63))
)

(func $emit_pair (param $p (ref $PAIR))
    (local $cur (ref null $PAIR))
    (local $cdr (ref null eq))

    (call $emit_lparen)
    (local.set $cur (local.get $p))

    (loop $loop (block $breakloop
        ;; print car
        (call $emit_value (struct.get $PAIR 0 (local.get $cur)))

        (local.set $cdr (struct.get $PAIR 1 (local.get $cur)))

        ;; end of list?
        (br_if $breakloop (ref.is_null (local.get $cdr)))

        ;; cdr is another pair, continue loop
        (if (ref.test (ref $PAIR) (local.get $cdr))
            (then
                (call $emit_space)
                (local.set $cur (ref.cast (ref $PAIR) (local.get $cdr)))
                br $loop
            )
            (else
                ;; cdr is not a pair, print dot and the cdr value, then end
                (call $emit (i32.const 32)) ;; space
                (call $emit (i32.const 46)) ;; '.'
                (call $emit (i32.const 32)) ;; space
                (call $emit_value (local.get $cdr))
                br $breakloop
            )
        )
    ))

    (call $emit_rparen)
)

(func $write (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (call $emit_value (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $arg))))
    (call $emit (i32.const 10)) ;; newline
    (ref.null eq)
)
`

const binopArithCode = `
(func \$\${NAME} (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (local $cur (ref null eq))
    (local $acc i32)

    ;; Initialize iteration over the argument list
    (local.set $cur (local.get $arg))

    ;; Handle empty arg list: return 0 by default
    (if (ref.is_null (local.get $cur))
        (then (return (ref.i31 (i32.const 0))))
    )

    ;; Seed accumulator with first argument
    (local.set $acc
        (i31.get_s
            (ref.cast (ref i31)
                (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $cur))))))

    (local.set $cur (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $cur))))

    ;; Reduce across remaining arguments using BINOP
    (loop $loop (block $breakloop
        (br_if $breakloop (ref.is_null (local.get $cur)))

        (local.set $acc (\${BINOP}
            (local.get $acc)
            (i31.get_s
                (ref.cast (ref i31)
                    (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $cur)))))))

        (local.set $cur (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $cur))))
        br $loop
    ))

    (ref.i31 (local.get $acc))
)
`

const binopCmpCode = `
(func \$\${NAME} (param $arg (ref null eq)) (param $env (ref null $ENV)) (result (ref null eq))
    (local $cur (ref null eq))
    (local $a i32)
    (local $b i32)

    ;; Initialize iteration over the argument list
    (local.set $cur (local.get $arg))

    ;; Empty or single-arg comparisons are vacuously true
    (if (ref.is_null (local.get $cur))
        (then (return (struct.new $BOOL (i32.const 1))))
    )

    (local.set $a
        (i31.get_s
            (ref.cast (ref i31)
                (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $cur))))))
    (local.set $cur (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $cur))))

    ;; Chain comparisons across remaining arguments
    (loop $loop (block $breakloop
        (br_if $breakloop (ref.is_null (local.get $cur)))
        (local.set $b
            (i31.get_s
                (ref.cast (ref i31)
                    (struct.get $PAIR 0 (ref.cast (ref $PAIR) (local.get $cur))))))
        (if (\${BINOP} (local.get $a) (local.get $b))
            (then
                (local.set $a (local.get $b))
                (local.set $cur (struct.get $PAIR 1 (ref.cast (ref $PAIR) (local.get $cur))))
                br $loop
            )
            (else
                (return (struct.new $BOOL (i32.const 0)))
            )
        )
    ))
    (struct.new $BOOL (i32.const 1))
)
`

registerBuiltIn('car', carCode, {})
registerBuiltIn('cdr', cdrCode, {})
registerBuiltIn('cadr', cadrCode, {})
registerBuiltIn('caddr', caddrCode, {})
registerBuiltIn('cons', consCode, {})
registerBuiltIn('list', listCode, {})
registerBuiltIn('set-car!', setCarCode, {})
registerBuiltIn('set-cdr!', setCdrCode, {})
registerBuiltIn('null?', nullpCode, {})
registerBuiltIn('number?', numberpCode, {})
registerBuiltIn('symbol?', symbolpCode, {})
registerBuiltIn('boolean?', booleanpCode, {})
registerBuiltIn('pair?', pairpCode, {})
registerBuiltIn('zero?', zeropCode, {})
registerBuiltIn('eqv?', eqvpCode, {})
registerBuiltIn('eq?', eqpCode, {})
registerBuiltIn('and', andCode, {})
registerBuiltIn('or', orCode, {})
registerBuiltIn('write', writeCode, {})
registerBuiltIn('+', binopArithCode, { NAME: '_add', BINOP: 'i32.add' })
registerBuiltIn('-', binopArithCode, { NAME: '_sub', BINOP: 'i32.sub' })
registerBuiltIn('*', binopArithCode, { NAME: '_mul', BINOP: 'i32.mul' })
registerBuiltIn('quotient', binopArithCode, {
  NAME: '_div',
  BINOP: 'i32.div_s',
})
registerBuiltIn('modulo', binopArithCode, { NAME: '_mod', BINOP: 'i32.rem_s' })
registerBuiltIn('<', binopCmpCode, { NAME: '_lt', BINOP: 'i32.lt_s' })
registerBuiltIn('<=', binopCmpCode, { NAME: '_le', BINOP: 'i32.le_s' })
registerBuiltIn('>', binopCmpCode, { NAME: '_gt', BINOP: 'i32.gt_s' })
registerBuiltIn('>=', binopCmpCode, { NAME: '_ge', BINOP: 'i32.ge_s' })
registerBuiltIn('=', binopCmpCode, { NAME: '_eq', BINOP: 'i32.eq' })
