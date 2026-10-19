import Placeholder from '../components/Placeholder'

export default function Tasks() {
  return (
    <Placeholder
      title="Tasks"
      day="Day 5"
      lines={[
        'Lists: Build-out · Launch event · Vendors · Punch list',
        'Fields: assignee, due date, status, priority, notes',
        'Link a task to an object or wall — "fly there" from the list',
        'Filters by list, assignee, status; realtime sync',
      ]}
    />
  )
}
