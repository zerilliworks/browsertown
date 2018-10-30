import * as _ from 'lodash'

// Map of UserID -> Cursor object
let cursors = {}

function setCursor(user, startPos, seq) {
  _.set(cursors, user.id, {...startPos, _seq: seq})
}

function updateCursor(user, pos, seq) {
  if(_.get(cursors, [user.id, '_seq'], 0) < seq) {
    setCursor(user, pos, seq)
  }
}

function addCursor(user) {
  setCursor(user, {x: 0, y: 0}, 1)
}

function removeCursor(user) {
  delete cursors[user.id]
}
