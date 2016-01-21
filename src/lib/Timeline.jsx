import React, { Component } from 'react'
import moment from 'moment'
import './Timeline.scss'

import Items from './items/Items.jsx'
import InfoLabel from './layout/InfoLabel.jsx'
import Sidebar from './layout/Sidebar.jsx'
import Header from './layout/Header.jsx'
import VerticalLines from './lines/VerticalLines.jsx'
import HorizontalLines from './lines/HorizontalLines.jsx'
import TodayLine from './lines/TodayLine.jsx'

import { getMinUnit, getNextUnit, getParentPosition, _get, _length } from './utils.js'

const defaultKeys = {
  groupIdKey: 'id',
  groupTitleKey: 'title',
  itemIdKey: 'id',
  itemTitleKey: 'title',
  itemGroupKey: 'group',
  itemTimeStartKey: 'start_time',
  itemTimeEndKey: 'end_time'
}

export default class ReactCalendarTimeline extends Component {
  constructor (props) {
    super(props)

    let visibleTimeStart = null
    let visibleTimeEnd = null

    if (this.props.defaultTimeStart && this.props.defaultTimeEnd) {
      visibleTimeStart = this.props.defaultTimeStart.valueOf()
      visibleTimeEnd = this.props.defaultTimeEnd.valueOf()
    } else if (this.props.visibleTimeStart && this.props.visibleTimeEnd) {
      visibleTimeStart = this.props.visibleTimeStart
      visibleTimeEnd = this.props.visibleTimeEnd
    } else {
      visibleTimeStart = Math.min(...this.props.items.map(item => _get(item, 'start').getTime()))
      visibleTimeEnd = Math.max(...this.props.items.map(item => _get(item, 'end').getTime()))

      if (!visibleTimeStart || !visibleTimeEnd) {
        visibleTimeStart = new Date().getTime() - 86400 * 7 * 1000
        visibleTimeEnd = new Date().getTime() + 86400 * 7 * 1000
      }

      if (this.props.onTimeInit) {
        this.props.onTimeInit(visibleTimeStart, visibleTimeEnd)
      }
    }

    this.state = {
      width: 1000,

      visibleTimeStart: visibleTimeStart,
      visibleTimeEnd: visibleTimeEnd,
      canvasTimeStart: visibleTimeStart - (visibleTimeEnd - visibleTimeStart),

      selectedItem: null,
      dragTime: null,
      dragGroupTitle: null,
      resizeEnd: null
    }
  }

  componentDidMount () {
    this.resize()

    this.resizeEventListener = {
      handleEvent: (event) => {
        this.resize()
      }
    }

    window.addEventListener('resize', this.resizeEventListener)

    this.lastTouchDistance = null
    this.refs.scrollComponent.addEventListener('touchstart', this.touchStart.bind(this))
    this.refs.scrollComponent.addEventListener('touchmove', this.touchMove.bind(this))
    this.refs.scrollComponent.addEventListener('touchend', this.touchEnd.bind(this))
  }

  componentWillUnmount () {
    window.removeEventListener('resize', this.resizeEventListener)
    this.refs.scrollComponent.removeEventListener('touchstart', this.touchStart.bind(this))
    this.refs.scrollComponent.removeEventListener('touchmove', this.touchMove.bind(this))
    this.refs.scrollComponent.removeEventListener('touchend', this.touchEnd.bind(this))
  }

  touchStart (e) {
    if (e.touches.length === 2) {
      e.preventDefault()

      this.lastTouchDistance = Math.abs(e.touches[0].screenX - e.touches[1].screenX)
      this.singleTouchStart = null
      this.lastSingleTouch = null
    } else if (e.touches.length === 1 && this.props.fixedHeader === 'fixed') {
      e.preventDefault()

      let x = e.touches[0].clientX
      let y = e.touches[0].clientY

      this.lastTouchDistance = null
      this.singleTouchStart = {x: x, y: y, screenY: window.pageYOffset}
      this.lastSingleTouch = {x: x, y: y, screenY: window.pageYOffset}
    }
  }

  touchMove (e) {
    if (this.state.dragTime || this.state.resizeEnd) {
      e.preventDefault()
      return
    }
    if (this.lastTouchDistance && e.touches.length === 2) {
      e.preventDefault()

      let touchDistance = Math.abs(e.touches[0].screenX - e.touches[1].screenX)

      let parentPosition = getParentPosition(e.currentTarget)
      let xPosition = (e.touches[0].screenX + e.touches[1].screenX) / 2 - parentPosition.x

      if (touchDistance !== 0 && this.lastTouchDistance !== 0) {
        this.changeZoom(this.lastTouchDistance / touchDistance, xPosition / this.state.width)
        this.lastTouchDistance = touchDistance
      }
    } else if (this.lastSingleTouch && e.touches.length === 1 && this.props.fixedHeader === 'fixed') {
      e.preventDefault()

      let x = e.touches[0].clientX
      let y = e.touches[0].clientY

      let deltaX = x - this.lastSingleTouch.x
      // let deltaY = y - this.lastSingleTouch.y

      let deltaX0 = x - this.singleTouchStart.x
      let deltaY0 = y - this.singleTouchStart.y

      this.lastSingleTouch = {x: x, y: y}

      let moveX = Math.abs(deltaX0) * 3 > Math.abs(deltaY0)
      let moveY = Math.abs(deltaY0) * 3 > Math.abs(deltaX0)

      if (deltaX !== 0 && moveX) {
        this.refs.scrollComponent.scrollLeft -= deltaX
      }
      if (moveY) {
        window.scrollTo(window.pageXOffset, this.singleTouchStart.screenY - deltaY0)
      }
    }
  }

  touchEnd (e) {
    if (this.lastTouchDistance) {
      e.preventDefault()

      this.lastTouchDistance = null
    }
    if (this.lastSingleTouch) {
      e.preventDefault()

      this.lastSingleTouch = null
      this.singleTouchStart = null
    }
  }

  resize () {
    let width = this.refs.container.clientWidth - this.props.sidebarWidth
    this.setState({
      width: width
    })
    this.refs.scrollComponent.scrollLeft = width
  }

  onScroll () {
    const scrollComponent = this.refs.scrollComponent
    const canvasTimeStart = this.state.canvasTimeStart
    const scrollX = scrollComponent.scrollLeft
    const zoom = this.state.visibleTimeEnd - this.state.visibleTimeStart
    const width = this.state.width
    const visibleTimeStart = canvasTimeStart + (zoom * scrollX / width)

    // move the virtual canvas if needed
    if (scrollX < this.state.width * 0.5) {
      this.setState({
        canvasTimeStart: this.state.canvasTimeStart - zoom
      })
      scrollComponent.scrollLeft += this.state.width
    }
    if (scrollX > this.state.width * 1.5) {
      this.setState({
        canvasTimeStart: this.state.canvasTimeStart + zoom
      })
      scrollComponent.scrollLeft -= this.state.width
    }

    if (this.state.visibleTimeStart !== visibleTimeStart || this.state.visibleTimeEnd !== visibleTimeStart + zoom) {
      this.props.onTimeChange.bind(this)(visibleTimeStart, visibleTimeStart + zoom)
    }
  }

  componentWillReceiveProps (nextProps) {
    const { visibleTimeStart, visibleTimeEnd } = nextProps

    if (visibleTimeStart && visibleTimeEnd) {
      this.updateScrollCanvas(visibleTimeStart, visibleTimeEnd)
    }
  }

  updateScrollCanvas (visibleTimeStart, visibleTimeEnd) {
    const oldCanvasTimeStart = this.state.canvasTimeStart
    const oldZoom = this.state.visibleTimeEnd - this.state.visibleTimeStart
    const newZoom = visibleTimeEnd - visibleTimeStart

    let newState = {
      visibleTimeStart: visibleTimeStart,
      visibleTimeEnd: visibleTimeEnd
    }

    let resetCanvas = false

    const canKeepCanvas = visibleTimeStart >= oldCanvasTimeStart + oldZoom * 0.5 &&
                          visibleTimeStart <= oldCanvasTimeStart + oldZoom * 1.5 &&
                          visibleTimeEnd >= oldCanvasTimeStart + oldZoom * 1.5 &&
                          visibleTimeEnd <= oldCanvasTimeStart + oldZoom * 2.5

    // if new visible time is in the right canvas area
    if (canKeepCanvas) {
      // but we need to update the scroll
      const newScrollLeft = Math.round(this.state.width * (visibleTimeStart - oldCanvasTimeStart) / newZoom)
      if (this.refs.scrollComponent.scrollLeft !== newScrollLeft) {
        resetCanvas = true
      }
    } else {
      resetCanvas = true
    }

    if (resetCanvas) {
      newState.canvasTimeStart = visibleTimeStart - newZoom
      this.refs.scrollComponent.scrollLeft = this.state.width
      if (this.props.onBoundsChange) {
        this.props.onBoundsChange(newState.canvasTimeStart, newState.canvasTimeStart + newZoom * 3)
      }
    }

    this.setState(newState)
  }

  onWheel (e) {
    if (e.ctrlKey) {
      e.preventDefault()
      const parentPosition = getParentPosition(e.currentTarget)
      const xPosition = e.clientX - parentPosition.x
      this.changeZoom(1.0 + e.deltaY / 50, xPosition / this.state.width)
    } else if (e.shiftKey) {
      e.preventDefault()
      const scrollComponent = this.refs.scrollComponent
      scrollComponent.scrollLeft += e.deltaY
    } else {
      if (this.props.fixedHeader === 'fixed') {
        e.preventDefault()
        if (e.deltaX !== 0) {
          this.refs.scrollComponent.scrollLeft += e.deltaX
        }
        if (e.deltaY !== 0) {
          window.scrollTo(window.pageXOffset, window.pageYOffset + e.deltaY)
        }
      }
    }
  }

  zoomIn (e) {
    e.preventDefault()

    this.changeZoom(0.75)
  }

  zoomOut (e) {
    e.preventDefault()

    this.changeZoom(1.25)
  }

  changeZoom (scale, offset = 0.5) {
    const { minZoom, maxZoom } = this.props
    const oldZoom = this.state.visibleTimeEnd - this.state.visibleTimeStart
    const newZoom = Math.min(Math.max(Math.round(oldZoom * scale), minZoom), maxZoom) // min 1 min, max 20 years
    const newVisibleTimeStart = Math.round(this.state.visibleTimeStart + (oldZoom - newZoom) * offset)

    this.props.onTimeChange.bind(this)(newVisibleTimeStart, newVisibleTimeStart + newZoom)
  }

  showPeriod (from, unit) {
    let visibleTimeStart = from.valueOf()
    let visibleTimeEnd = moment(from).add(1, unit).valueOf()
    let zoom = visibleTimeEnd - visibleTimeStart

    // can't zoom in more than to show one hour
    if (zoom < 360000) {
      return
    }

    // clicked on the big header and already focused here, zoom out
    if (unit !== 'year' && this.state.visibleTimeStart === visibleTimeStart && this.state.visibleTimeEnd === visibleTimeEnd) {
      let nextUnit = getNextUnit(unit)

      visibleTimeStart = from.startOf(nextUnit).valueOf()
      visibleTimeEnd = moment(visibleTimeStart).add(1, nextUnit)
      zoom = visibleTimeEnd - visibleTimeStart
    }

    this.props.onTimeChange.bind(this)(visibleTimeStart, visibleTimeStart + zoom)
  }

  selectItem (item, clickType) {
    if (this.state.selectedItem === item || (this.props.itemTouchSendsClick && clickType === 'touch')) {
      if (item && this.props.onItemClick) {
        this.props.onItemClick(item)
      }
    } else {
      this.setState({selectedItem: item})
    }
  }

  rowAndTimeFromEvent (e) {
    const { lineHeight, dragSnap } = this.props
    const { width, visibleTimeStart, visibleTimeEnd } = this.state

    const parentPosition = getParentPosition(e.currentTarget)
    const x = e.clientX - parentPosition.x
    const y = e.clientY - parentPosition.y

    const row = Math.floor((y - (lineHeight * 2)) / lineHeight)
    let time = Math.round(visibleTimeStart + x / width * (visibleTimeEnd - visibleTimeStart))
    time = Math.floor(time / dragSnap) * dragSnap

    return [row, time]
  }

  scrollAreaClick (e) {
    // if not clicking on an item
    if (e.target.className.indexOf('rct-item') === -1) {
      if (this.state.selectedItem) {
        this.selectItem(null)
      } else if (this.props.onCanvasClick) {
        const [row, time] = this.rowAndTimeFromEvent(e)
        if (row >= 0 && row < this.props.groups.length) {
          const groupId = _get(this.props.groups[row], this.props.keys.groupIdKey)
          this.props.onCanvasClick(groupId, time, e)
        }
      }
    }
  }

  dragItem (item, dragTime, newGroupOrder) {
    let newGroup = this.props.groups[newGroupOrder]
    this.setState({
      dragTime: dragTime,
      dragGroupTitle: newGroup ? newGroup.title : ''
    })
  }

  dropItem (item, dragTime, newGroupOrder) {
    this.setState({dragTime: null, dragGroupTitle: null})
    if (this.props.onItemMove) {
      this.props.onItemMove(item, dragTime, newGroupOrder)
    }
  }

  resizingItem (item, newResizeEnd) {
    this.setState({resizeEnd: newResizeEnd})
  }

  resizedItem (item, newResizeEnd) {
    this.setState({resizeEnd: null})
    if (this.props.onItemResize) {
      this.props.onItemResize(item, newResizeEnd)
    }
  }

  todayLine () {
    const canvasTimeStart = this.state.canvasTimeStart
    const zoom = this.state.visibleTimeEnd - this.state.visibleTimeStart
    const canvasTimeEnd = canvasTimeStart + zoom * 3
    const canvasWidth = this.state.width * 3

    return (
      <TodayLine canvasTimeStart={canvasTimeStart}
                 canvasTimeEnd={canvasTimeEnd}
                 canvasWidth={canvasWidth}
                 lineHeight={this.props.lineHeight}
                 lineCount={_length(this.props.groups)} />
    )
  }

  verticalLines () {
    const canvasTimeStart = this.state.canvasTimeStart
    const zoom = this.state.visibleTimeEnd - this.state.visibleTimeStart
    const canvasTimeEnd = canvasTimeStart + zoom * 3
    const canvasWidth = this.state.width * 3
    const minUnit = getMinUnit(zoom, this.state.width)

    return (
      <VerticalLines canvasTimeStart={canvasTimeStart}
                     canvasTimeEnd={canvasTimeEnd}
                     canvasWidth={canvasWidth}
                     lineHeight={this.props.lineHeight}
                     lineCount={_length(this.props.groups)}
                     minUnit={minUnit}
                     fixedHeader={this.props.fixedHeader} />
    )
  }

  horizontalLines () {
    const canvasWidth = this.state.width * 3

    return (
      <HorizontalLines canvasWidth={canvasWidth}
                       lineHeight={this.props.lineHeight}
                       lineCount={_length(this.props.groups)} />
    )
  }

  items () {
    const zoom = this.state.visibleTimeEnd - this.state.visibleTimeStart
    const minUnit = getMinUnit(zoom, this.state.width)
    const canvasTimeStart = this.state.canvasTimeStart
    const canvasTimeEnd = canvasTimeStart + zoom * 3
    const canvasWidth = this.state.width * 3

    return (
      <Items canvasTimeStart={canvasTimeStart}
             canvasTimeEnd={canvasTimeEnd}
             canvasWidth={canvasWidth}
             lineHeight={this.props.lineHeight}
             lineCount={_length(this.props.groups)}
             minUnit={minUnit}
             items={this.props.items}
             groups={this.props.groups}
             keys={this.props.keys}
             selectedItem={this.state.selectedItem}
             dragSnap={this.props.dragSnap}
             minResizeWidth={this.props.minResizeWidth}
             canChangeGroup={this.props.canChangeGroup}
             canMove={this.props.canMove}
             canResize={this.props.canResize}
             moveResizeValidator={this.props.moveResizeValidator}
             itemSelect={this.selectItem.bind(this)}
             itemDrag={this.dragItem.bind(this)}
             itemDrop={this.dropItem.bind(this)}
             itemResizing={this.resizingItem.bind(this)}
             itemResized={this.resizedItem.bind(this)} />
    )
  }

  infoLabel () {
    let label = null

    if (this.state.dragTime) {
      label = `${moment(this.state.dragTime).format('LLL')}, ${this.state.dragGroupTitle}`
    } else if (this.state.resizeEnd) {
      label = moment(this.state.resizeEnd).format('LLL')
    }

    return label ? <InfoLabel label={label} /> : ''
  }

  header () {
    const canvasTimeStart = this.state.canvasTimeStart
    const zoom = this.state.visibleTimeEnd - this.state.visibleTimeStart
    const canvasTimeEnd = canvasTimeStart + zoom * 3
    const canvasWidth = this.state.width * 3
    const minUnit = getMinUnit(zoom, this.state.width)

    return (
      <Header canvasTimeStart={canvasTimeStart}
              canvasTimeEnd={canvasTimeEnd}
              canvasWidth={canvasWidth}
              lineHeight={this.props.lineHeight}
              minUnit={minUnit}
              width={this.state.width}
              zoom={zoom}
              visibleTimeStart={this.state.visibleTimeStart}
              visibleTimeEnd={this.state.visibleTimeEnd}
              fixedHeader={this.props.fixedHeader}
              zIndex={this.props.zIndexStart + 1}
              showPeriod={this.showPeriod.bind(this)} />
    )
  }

  sidebar () {
    return (
      <Sidebar groups={this.props.groups}
               keys={this.props.keys}

               width={this.props.sidebarWidth}
               lineHeight={this.props.lineHeight}

               fixedHeader={this.props.fixedHeader}
               zIndex={this.props.zIndexStart + 2}>
        {this.props.children}
      </Sidebar>
    )
  }

  render () {
    const width = this.state.width
    const height = (_length(this.props.groups) + 2) * this.props.lineHeight
    const canvasWidth = this.state.width * 3

    const outerComponentStyle = {
      height: `${height}px`
    }

    const scrollComponentStyle = {
      width: `${width}px`,
      height: `${height + 20}px`
    }

    const canvasComponentStyle = {
      width: `${canvasWidth}px`,
      height: `${height}px`
    }

    return (
      <div style={this.props.style} ref='container' className='react-calendar-timeline'>
        <div style={outerComponentStyle} className='rct-outer'>
          {this.sidebar()}
          <div ref='scrollComponent'
               className='rct-scroll'
               style={scrollComponentStyle}
               onClick={this.scrollAreaClick.bind(this)}
               onScroll={this.onScroll.bind(this)}
               onWheel={this.onWheel.bind(this)}>
            <div ref='canvasComponent'
                 className='rct-canvas'
                 style={canvasComponentStyle}>
              {this.verticalLines()}
              {this.horizontalLines()}
              {this.todayLine()}
              {this.items()}
              {this.infoLabel()}
              {this.header()}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

ReactCalendarTimeline.propTypes = {
  groups: React.PropTypes.oneOfType([React.PropTypes.array, React.PropTypes.object]).isRequired,
  items: React.PropTypes.oneOfType([React.PropTypes.array, React.PropTypes.object]).isRequired,
  sidebarWidth: React.PropTypes.number,
  dragSnap: React.PropTypes.number,
  minResizeWidth: React.PropTypes.number,
  fixedHeader: React.PropTypes.oneOf(['fixed', 'absolute', 'none']),
  zIndexStart: React.PropTypes.number,
  lineHeight: React.PropTypes.number,

  minZoom: React.PropTypes.number,
  maxZoom: React.PropTypes.number,

  canChangeGroup: React.PropTypes.bool,
  canMove: React.PropTypes.bool,
  canResize: React.PropTypes.bool,

  itemTouchSendsClick: React.PropTypes.bool,

  onItemMove: React.PropTypes.func,
  onItemResize: React.PropTypes.func,
  onItemClick: React.PropTypes.func,
  onCanvasClick: React.PropTypes.func,

  moveResizeValidator: React.PropTypes.func,

  dayBackground: React.PropTypes.func,

  style: React.PropTypes.object,
  keys: React.PropTypes.object,

  defaultTimeStart: React.PropTypes.object,
  defaultTimeEnd: React.PropTypes.object,

  visibleTimeStart: React.PropTypes.number,
  visibleTimeEnd: React.PropTypes.number,
  onTimeChange: React.PropTypes.func,
  onTimeInit: React.PropTypes.func,
  onBoundsChange: React.PropTypes.func,

  children: React.PropTypes.node
}
ReactCalendarTimeline.defaultProps = {
  sidebarWidth: 150,
  dragSnap: 1000 * 60 * 15, // 15min
  minResizeWidth: 20,
  fixedHeader: 'none', // fixed or absolute or none
  zIndexStart: 10,
  lineHeight: 30,

  minZoom: 60 * 60 * 1000, // 1 hour
  maxZoom: 5 * 365.24 * 86400 * 1000, // 5 years

  canChangeGroup: true,
  canMove: true,
  canResize: true,

  onItemMove: null,
  onItemResize: null,
  onItemClick: null,
  onCanvasClick: null,

  moveResizeValidator: null,

  dayBackground: null,

  defaultTimeStart: null,
  defaultTimeEnd: null,

  itemTouchSendsClick: false,

  style: {},
  keys: defaultKeys,

  // if you pass in visibleTimeStart and visibleTimeEnd, you must also pass onTimeChange(visibleTimeStart, visibleTimeEnd),
  // which needs to update the props visibleTimeStart and visibleTimeEnd to the ones passed
  visibleTimeStart: null,
  visibleTimeEnd: null,
  onTimeChange: function (visibleTimeStart, visibleTimeEnd) {
    this.updateScrollCanvas(visibleTimeStart, visibleTimeEnd)
  },
  // called after the calendar loads and the visible time has been calculated
  onTimeInit: null,
  // called when the canvas area of the calendar changes
  onBoundsChange: null,
  children: null
}
