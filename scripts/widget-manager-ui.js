'use strict'

const list = document.getElementById('widgetList')
const status = document.getElementById('managerStatus')
const api = window.audioWaveWidgets

function button(label, action, primary = false) {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  if (primary) element.className = 'primary'
  element.addEventListener('click', action)
  return element
}

async function render() {
  list.replaceChildren()
  if (!api) {
    status.textContent = 'Widget controls are unavailable in this window.'
    return
  }
  try {
    const widgets = await api.list()
    for (const widget of widgets) {
      const card = document.createElement('article')
      card.className = 'widget-card'
      const copy = document.createElement('div')
      copy.className = 'widget-copy'
      const title = document.createElement('h2')
      title.textContent = widget.name
      const description = document.createElement('p')
      description.textContent = widget.description
      const detail = document.createElement('small')
      detail.textContent = `First-party · ${widget.publisher} · v${widget.version}`
      copy.append(title, description, detail)
      const actions = document.createElement('div')
      actions.className = 'actions'
      if (widget.installed) {
        actions.append(button('Open', async () => {
          try { await api.open(widget.id); status.textContent = `${widget.name} opened.` }
          catch (error) { status.textContent = error.message }
        }, true))
        actions.append(button('Remove', async () => {
          try { await api.uninstall(widget.id); status.textContent = `${widget.name} removed.`; await render() }
          catch (error) { status.textContent = error.message }
        }))
      } else {
        actions.append(button('Install', async () => {
          try { await api.install(widget.id); status.textContent = `${widget.name} installed.`; await render() }
          catch (error) { status.textContent = error.message }
        }, true))
      }
      card.append(copy, actions)
      list.append(card)
    }
    if (!widgets.length) status.textContent = 'No widgets are available yet.'
    else if (!status.textContent) status.textContent = 'Choose a widget to install or manage.'
  } catch (error) {
    status.textContent = error.message || 'Could not load widgets.'
  }
}

void render()
