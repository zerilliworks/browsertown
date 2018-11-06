import {withRouter} from 'next/router'
import SearchBar from '../interface/SearchBar'
import CommentBubble from '../interface/CommentBubble'
import * as React from 'react'
import {map} from 'lodash'
import TownPlane from '../interface/TownPlane'

const DimensionScreen = ({router}) => (
  <TownPlane renderControls={() => <SearchBar/>}/>
)

export default withRouter(DimensionScreen)