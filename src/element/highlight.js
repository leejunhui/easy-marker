import BaseElement from './base'
import TextNode from '../lib/text_node'
import { getTouchPosition, inRectangle, anyToPx, rectToPointArray } from '../lib/helpers'
import { EasyMarkerMode, NoteType } from '../lib/types'

/**
 * Highlight
 *
 * @export
 * @class Highlight
 * @extends {BaseElement}
 */
export default class Highlight extends BaseElement {
  constructor(container, option) {
    super()
    const defaultOptions = {
      highlightColor: '#FEFFCA',
      underlineColor: '#af8978',
      opacity: 1,
      type: 'highlight',
      // margin: '0.1rem',
    }
    this.container = container
    this.mode = option.mode || EasyMarkerMode.NODE
    this.option = Object.assign(defaultOptions, option)
    if (option.color) {
      this.option.highlightColor = option.color
    }
    this.type = this.option.type || NoteType.Highlight
    this.option.margin = anyToPx(this.option.margin)
    this.lineMap = new Map()
    // this.onClick = () => { }
    this.createElement()
    this.mount()
    this.id = 0
    this.easyMarker = null
  }

  getID() {
    return this.id++
  }

  /**
   *
   *
   * @param {Selection} selection
   * @param {any} id
   * @param {any} meta
   * @param {Object} offset
   * @param {number} offset.x
   * @param {number} offset.y
   * @memberof Highlight
   */
  highlight(selection, id, meta = {}, offset) {
    const lineID = id === undefined || id === null ? this.getID() : id
    let points
    let selectionContent
    let relativeRects = []
    let lineHeight
    if (this.mode === EasyMarkerMode.NODE) {
      const startTextNode = new TextNode(selection.anchorNode, selection.anchorOffset)
      const endTextNode = new TextNode(selection.focusNode, selection.focusOffset)
      lineHeight = Number(window.getComputedStyle(selection.anchorNode.parentElement).lineHeight.replace('px', ''))
      let rects
      let text
      try {
        ({ rects, text } = TextNode.getSelectNodeRectAndText(
          startTextNode.node,
          endTextNode.node,
          startTextNode.offset,
          endTextNode.offset
        ))
      } catch (error) {
        console.error('EasyMarkerError:', error) // eslint-disable-line no-console
        rects = []
        text = ''
      }


      points = rects.map((rect) => {
        const relativeRect = {
          top: rect.top - offset.y,
          bottom: rect.bottom - offset.y,
          height: rect.height,
          width: rect.width,
          left: rect.left - offset.x,
          right: rect.right - offset.x,
        }
        relativeRects.push(relativeRect)
        lineHeight = lineHeight || rect.height
        const margin = this.option.margin || (lineHeight - rect.height) / 4
        return rectToPointArray(rect, offset, margin)
      })
      let markdown
      if (this.easyMarker && this.easyMarker.markdown) {
        ({ markdown } = this.easyMarker.markdown.getSelectMarkdown(
          startTextNode.node,
          endTextNode.node,
          startTextNode.offset,
          endTextNode.offset
        ))
      } else {
        markdown = ''
      }

      selectionContent = Object.assign({
        toString() {
          return text
        },
        toMarkdown() {
          return markdown
        },
      }, selection)
    } else {
      const { start, end } = selection
      relativeRects = this.easyMarker && this.easyMarker.region.getRects(start, end)
      const text = this.easyMarker && this.easyMarker.region.getText(start, end)
      const markdown = this.easyMarker && this.easyMarker.constructor.getSelectMarkdown()
      points = relativeRects.map((rect) => {
        const margin = 0
        return rectToPointArray(rect, { x: 0, y: 0 }, margin)
      })
      selectionContent = Object.assign({
        toString() {
          return text
        },
        toMarkdown() {
          return markdown
        },
      }, selection)
    }

    this.lineMap.set(lineID, {
      selection: selectionContent, points, relativeRects, meta, lineHeight,
    })
    return lineID
  }

  render() {
    this.removeAllRectangle()
    this.lineMap.forEach((line) => {
      const type = line.meta.type || this.type
      line.points.forEach((points) => {
        if (type === NoteType.UNDERLINE) {
          this.element.appendChild(this.createLine(points))
        } else {
          this.element.appendChild(this.createRectangle(points))
        }
      })
    })
  }

  /**
   *
   *
   * @param {Object[]} lines
   * @param {Selection} lines[].selection
   * @param {any} [lines[].id]
   * @param {any} [lines[].meta]
   * @memberof Highlight
   */
  highlightLines(lines, offset) {
    this.lineMap.clear()
    const ids = lines.map(({ selection, id, meta }) => this.highlight(selection, id, meta, offset))
    this.render()
    return ids
  }

  /**
   *
   *
   * @param {Selection} selection
   * @param {*} id
   * @param {*} meta
   * @param {Object} offset
   * @memberof Highlight
   */
  highlightLine(selection, id, meta, offset) {
    const lineID = this.highlight(selection, id, meta, offset)
    this.render()
    return lineID
  }

  /**
   *
   *
   * @param {any} id
   * @returns {boolean}
   * @memberof Highlight
   */
  cancelHighlightLine(id) {
    this.lineMap.delete(id)
    this.render()
  }

  createElement() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.style.zIndex = '1'
    svg.style.width = '100%'
    svg.style.height = '100%'
    svg.style.position = 'absolute'
    svg.style.top = '0'
    svg.style.left = '0'
    svg.style.overflow = 'visible'
    this.element = svg
  }

  createLine(pointList) {
    const x1 = pointList[2][0]
    const y1 = pointList[2][1] + 1
    const x2 = pointList[3][0]
    const y2 = pointList[3][1] + 1
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.style.stroke = this.option.underlineColor
    line.setAttribute('x1', x1)
    line.setAttribute('y1', y1)
    line.setAttribute('x2', x2)
    line.setAttribute('y2', y2)
    return line
  }

  createRectangle(pointList) {
    const points = pointList.reduce((acc, [x, y]) => (acc === '' ? `${x},${y}` : `${acc} ${x},${y}`), '')
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    polygon.style.fill = this.option.highlightColor
    polygon.style.strokeWidth = 0
    polygon.style.strokeOpacity = this.option.opacity
    polygon.style.opacity = this.option.opacity
    polygon.setAttribute('points', points)
    return polygon
  }

  handleTap(e) {
    const { x, y } = getTouchPosition(e)
    const { top, left } = this.container.getBoundingClientRect()
    let clickLine
    this.lineMap.forEach((line, id) => {
      for (let i = 0; i < line.relativeRects.length; i++) {
        const rect = line.relativeRects[i]
        const margin = line.lineHeight ? (line.lineHeight - rect.height) / 2 : 0
        if (inRectangle(x - left, y - top, rect, margin)) {
          clickLine = { id, line }
          break
        }
      }
    })
    if (clickLine && this.easyMarker) {
      if (this.easyMarker.highlightLineClick) {
        this.easyMarker.highlightLineClick(clickLine.id, clickLine.line.meta, clickLine.line.selection)
      } else {
        this.easyMarker.showHighlightMenu(clickLine.line.selection, { id: clickLine.id, meta: clickLine.line.meta })
      }
      return true
    }
    return false
  }

  inRegion(e) {
    const { x, y } = getTouchPosition(e)
    const { top, left } = this.container.getBoundingClientRect()
    let clickLine
    this.lineMap.forEach((line, id) => {
      for (let i = 0; i < line.relativeRects.length; i++) {
        const rect = line.relativeRects[i]
        const margin = line.lineHeight ? (line.lineHeight - rect.height) / 2 : 0
        if (inRectangle(x - left, y - top, rect, margin)) {
          clickLine = { id, line }
          break
        }
      }
    })
    if (clickLine && this.easyMarker) {
      return true
    }
    return false
  }

  removeAllRectangle() {
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild)
    }
  }
}
