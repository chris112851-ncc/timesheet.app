import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { LogOut, Clock, Plus, Trash2, Users, Settings, FileText, Download, Upload, Lock, Unlock } from 'lucide-react'
import * as XLSX from 'xlsx'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [entries, setEntries] = useState([])
  const [lockedDates, setLockedDates] = useState([])
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [activeTab, setActiveTab] = useState('timesheet')
  const [newClient, setNewClient] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'team' })
  const [timesheetForm, setTimesheetForm] = useState({
    date: new Date().toISOString().split('T')[0],
    client: '',
    task: '',
    startTime: '',
    endTime: '',
    description: ''
  })
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    client: 'all',
    task: 'all',
    user: 'all'
  })
  const [lockDate, setLockDate] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const r1 = await supabase.from('users').select('*')
      if (r1.data) setUsers(r1.data)
      
      const r2 = await supabase.from('clients').select('*')
      if (r2.data) setClients(r2.data.map(c => c.name))
      
      const r3 = await supabase.from('tasks').select('*')
      if (r3.data) setTasks(r3.data.map(t => t.name))
      
      const r4 = await supabase.from('entries').select('*').limit(100000).order('date', { ascending: false })
      if (r4.data) setEntries(r4.data.map(e => ({...e, startTime: e.start_time, endTime: e.end_time})))
      
      const r5 = await supabase.from('locked_dates').select('*')
      if (r5.data) setLockedDates(r5.data.map(d => d.date))
    } catch (err) {
      console.error(err)
    }
  }

  function handleLogin() {
    const user = users.find(u => u.username === loginForm.username && u.password === loginForm.password)
    if (user) {
      setCurrentUser(user)
    } else {
      alert('Invalid credentials')
    }
  }

  async function addClient() {
    if (!newClient || clients.includes(newClient)) return
    await supabase.from('clients').insert([{ name: newClient }])
    setClients([...clients, newClient])
    setNewClient('')
  }

  async function deleteClient(name) {
    await supabase.from('clients').delete().eq('name', name)
    setClients(clients.filter(c => c !== name))
  }

  async function addTask() {
    if (!newTask || tasks.includes(newTask)) return
    await supabase.from('tasks').insert([{ name: newTask }])
    setTasks([...tasks, newTask])
    setNewTask('')
  }

  async function deleteTask(name) {
    await supabase.from('tasks').delete().eq('name', name)
    setTasks(tasks.filter(t => t !== name))
  }

  async function addUser() {
    if (!newUser.username || !newUser.password || !newUser.name) {
      alert('Fill all fields')
      return
    }
    await supabase.from('users').insert([newUser])
    loadData()
    setNewUser({ username: '', password: '', name: '', role: 'team' })
  }

  async function deleteUser(username) {
    if (username === currentUser.username) {
      alert('Cannot delete yourself')
      return
    }
    if (confirm('Delete user ' + username + '?')) {
      await supabase.from('users').delete().eq('username', username)
      await supabase.from('entries').delete().eq('username', username)
      loadData()
    }
  }

  function calculateHours(start, end) {
    if (!start || !end) return 0
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    return ((eh * 60 + em - sh * 60 - sm) / 60).toFixed(2)
  }

  function isDateLocked(date) {
    return lockedDates.includes(date)
  }

  async function addEntry() {
    if (!timesheetForm.client || !timesheetForm.task || !timesheetForm.startTime || !timesheetForm.endTime) {
      alert('Fill all required fields')
      return
    }
    
    if (isDateLocked(timesheetForm.date)) {
      alert('This date has been locked by management. You cannot add entries for this date.')
      return
    }
    
    const hours = calculateHours(timesheetForm.startTime, timesheetForm.endTime)
    if (hours <= 0) {
      alert('End time must be after start time')
      return
    }
    const entry = {
      username: currentUser.username,
      name: currentUser.name,
      date: timesheetForm.date,
      client: timesheetForm.client,
      task: timesheetForm.task,
      start_time: timesheetForm.startTime,
      end_time: timesheetForm.endTime,
      hours: parseFloat(hours),
      description: timesheetForm.description
    }
    await supabase.from('entries').insert([entry])
    loadData()
    setTimesheetForm({
      date: new Date().toISOString().split('T')[0],
      client: '',
      task: '',
      startTime: '',
      endTime: '',
      description: ''
    })
  }

  async function deleteEntry(id, date) {
    if (isDateLocked(date)) {
      alert('This date has been locked. You cannot delete entries for this date.')
      return
    }
    
    if (confirm('Delete this entry?')) {
      await supabase.from('entries').delete().eq('id', id)
      loadData()
    }
  }

  async function handleLockDate() {
    if (!lockDate) {
      alert('Please select a date to lock')
      return
    }
    
    if (lockedDates.includes(lockDate)) {
      alert('This date is already locked')
      return
    }
    
    if (confirm(`Lock all timesheets for ${lockDate}? Users will not be able to add or delete entries for this date.`)) {
      await supabase.from('locked_dates').insert([{ date: lockDate }])
      setLockedDates([...lockedDates, lockDate])
      setLockDate('')
      alert('Date locked successfully')
    }
  }

  async function unlockDate(date) {
    if (confirm(`Unlock timesheets for ${date}? Users will be able to modify entries again.`)) {
      await supabase.from('locked_dates').delete().eq('date', date)
      setLockedDates(lockedDates.filter(d => d !== date))
      alert('Date unlocked successfully')
    }
  }

  const myEntries = entries.filter(e => e.username === currentUser?.username)

  async function changePassword() {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      alert('Fill all fields')
      return
    }
    if (currentUser.password !== passwordForm.current) {
      alert('Current password is incorrect')
      return
    }
    if (passwordForm.new.length < 6) {
      alert('New password must be at least 6 characters')
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      alert('Passwords do not match')
      return
    }
    await supabase.from('users').update({ password: passwordForm.new }).eq('username', currentUser.username)
    setCurrentUser({...currentUser, password: passwordForm.new})
    setPasswordForm({ current: '', new: '', confirm: '' })
    setShowPasswordModal(false)
    alert('Password changed successfully!')
  }

  function getFilteredReports() {
    let filtered = [...entries]
    if (reportFilters.startDate) {
      filtered = filtered.filter(e => e.date >= reportFilters.startDate)
    }
    if (reportFilters.endDate) {
      filtered = filtered.filter(e => e.date <= reportFilters.endDate)
    }
    if (reportFilters.client !== 'all') {
      filtered = filtered.filter(e => e.client === reportFilters.client)
    }
    if (reportFilters.task !== 'all') {
      filtered = filtered.filter(e => e.task === reportFilters.task)
    }
    if (reportFilters.user !== 'all') {
      filtered = filtered.filter(e => e.username === reportFilters.user)
    }
    return filtered
  }

  const reportEntries = getFilteredReports()
  const reportTotal = reportEntries.reduce((sum, e) => sum + parseFloat(e.hours || 0), 0).toFixed(2)

  function exportToCSV() {
    let csv = 'Date,User,Client,Task,Start,End,Hours,Description\n'
    reportEntries.forEach(e => {
      csv += `${e.date},${e.name},${e.client},${e.task},${e.startTime},${e.endTime},${e.hours},"${e.description || ''}"\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheet-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  function exportToExcel() {
    const wsData = [
      ['Date', 'User', 'Client', 'Task', 'Start', 'End', 'Hours', 'Description'],
      ...reportEntries.map(e => [
        e.date,
        e.name,
        e.client,
        e.task,
        e.startTime,
        e.endTime,
        e.hours,
        e.description || ''
      ]),
      [],
      ['Total Hours:', '', '', '', '', '', reportTotal, '']
    ]
    
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    
    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 20 }, // User
      { wch: 20 }, // Client
      { wch: 20 }, // Task
      { wch: 10 }, // Start
      { wch: 10 }, // End
      { wch: 8 },  // Hours
      { wch: 40 }  // Description
    ]
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet Report')
    XLSX.writeFile(wb, `timesheet-report-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function handleClientImport(e) {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
        
        const newClients = []
        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          if (row[0] && typeof row[0] === 'string') {
            const clientName = row[0].trim()
            if (clientName && clientName.toLowerCase() !== 'client' && clientName.toLowerCase() !== 'name') {
              if (!clients.includes(clientName) && !newClients.includes(clientName)) {
                newClients.push(clientName)
              }
            }
          }
        }
        
        if (newClients.length === 0) {
          alert('No new clients found in the file')
          return
        }
        
        const clientsToInsert = newClients.map(name => ({ name }))
        await supabase.from('clients').insert(clientsToInsert)
        
        setClients([...clients, ...newClients])
        alert(`Successfully imported ${newClients.length} client(s)`)
      } catch (err) {
        console.error(err)
        alert('Error importing file. Please make sure it\'s a valid Excel or CSV file with client names in the first column.')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const totalHours = myEntries.reduce((sum, e) => sum + parseFloat(e.hours || 0), 0).toFixed(2)

  if (!currentUser) {
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#667eea,#764ba2)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
        <div style={{background:'white',padding:'40px',borderRadius:'10px',width:'100%',maxWidth:'400px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
          <div style={{textAlign:'center',marginBottom:'30px'}}>
            <Clock size={50} style={{color:'#667eea',marginBottom:'10px'}}/>
            <h1 style={{fontSize:'28px',fontWeight:'bold',margin:'10px 0'}}>Timesheet App</h1>
            <p style={{color:'#666'}}>Sign in to continue</p>
          </div>
          <input placeholder="Username" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} style={{width:'100%',padding:'10px',marginBottom:'10px',border:'1px solid #ddd',borderRadius:'5px'}}/>
          <input type="password" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} onKeyPress={e => e.key === 'Enter' && handleLogin()} style={{width:'100%',padding:'10px',marginBottom:'20px',border:'1px solid #ddd',borderRadius:'5px'}}/>
          <button onClick={handleLogin} style={{width:'100%',padding:'12px',background:'#667eea',color:'white',border:'none',borderRadius:'5px',fontSize:'16px',fontWeight:'bold',cursor:'pointer'}}>Sign In</button>
          <p style={{marginTop:'20px',fontSize:'12px',textAlign:'center',color:'#666'}}>Demo: admin / admin123</p>
        </div>
      </div>
    )
  }

  const isManager = currentUser.role === 'manager'

  return (
    <div style={{minHeight:'100vh',background:'#f0f4f8'}}>
      <div style={{background:'white',boxShadow:'0 2px 4px rgba(0,0,0,0.1)',padding:'15px 0'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <Clock size={32} style={{color:'#667eea'}}/>
            <div>
              <h1 style={{fontSize:'20px',fontWeight:'bold',margin:0}}>Timesheet App</h1>
              <p style={{fontSize:'13px',color:'#666',margin:'4px 0 0 0'}}>
                {currentUser.name}
                <span style={{marginLeft:'8px',padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:'600',background:isManager?'#e0e7ff':'#dcfce7',color:isManager?'#4f46e5':'#16a34a'}}>
                  {isManager ? 'Manager' : 'Team'}
                </span>
              </p>
            </div>
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <button onClick={() => setShowPasswordModal(true)} style={{padding:'8px 16px',background:'#667eea',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px',fontWeight:'500'}}>
              Change Password
            </button>
            <button onClick={() => setCurrentUser(null)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',background:'#ef4444',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontSize:'14px',fontWeight:'500'}}>
              <LogOut size={16}/>Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'20px'}}>
        <div style={{background:'white',borderRadius:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          <div style={{borderBottom:'2px solid #e5e7eb',display:'flex',gap:'0'}}>
            <button onClick={() => setActiveTab('timesheet')} style={{padding:'14px 24px',background:activeTab==='timesheet'?'#667eea':'transparent',color:activeTab==='timesheet'?'white':'#666',border:'none',cursor:'pointer',fontSize:'14px',fontWeight:'600',borderRadius:'8px 8px 0 0'}}>
              <Clock size={16} style={{display:'inline',marginRight:'6px'}}/>My Timesheet
            </button>
            {isManager && (
              <>
                <button onClick={() => setActiveTab('reports')} style={{padding:'14px 24px',background:activeTab==='reports'?'#667eea':'transparent',color:activeTab==='reports'?'white':'#666',border:'none',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>
                  <FileText size={16} style={{display:'inline',marginRight:'6px'}}/>Reports
                </button>
                <button onClick={() => setActiveTab('locks')} style={{padding:'14px 24px',background:activeTab==='locks'?'#667eea':'transparent',color:activeTab==='locks'?'white':'#666',border:'none',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>
                  <Lock size={16} style={{display:'inline',marginRight:'6px'}}/>Lock Dates
                </button>
                <button onClick={() => setActiveTab('users')} style={{padding:'14px 24px',background:activeTab==='users'?'#667eea':'transparent',color:activeTab==='users'?'white':'#666',border:'none',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>
                  <Users size={16} style={{display:'inline',marginRight:'6px'}}/>Users
                </button>
                <button onClick={() => setActiveTab('clients')} style={{padding:'14px 24px',background:activeTab==='clients'?'#667eea':'transparent',color:activeTab==='clients'?'white':'#666',border:'none',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>
                  <Settings size={16} style={{display:'inline',marginRight:'6px'}}/>Clients
                </button>
                <button onClick={() => setActiveTab('tasks')} style={{padding:'14px 24px',background:activeTab==='tasks'?'#667eea':'transparent',color:activeTab==='tasks'?'white':'#666',border:'none',cursor:'pointer',fontSize:'14px',fontWeight:'600'}}>
                  <FileText size={16} style={{display:'inline',marginRight:'6px'}}/>Tasks
                </button>
              </>
            )}
          </div>

          <div style={{padding:'24px'}}>
            {activeTab === 'timesheet' && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:'bold',marginBottom:'20px'}}>Add Time Entry</h2>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'12px',marginBottom:'20px',padding:'20px',background:'#f9fafb',borderRadius:'8px'}}>
                  <div>
                    <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Date</label>
                    <input type="date" value={timesheetForm.date} onChange={e => setTimesheetForm({...timesheetForm, date: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}/>
                    {isDateLocked(timesheetForm.date) && (
                      <p style={{fontSize:'11px',color:'#dc2626',marginTop:'4px',display:'flex',alignItems:'center',gap:'4px'}}>
                        <Lock size={12}/> This date is locked
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Client *</label>
                    <select value={timesheetForm.client} onChange={e => setTimesheetForm({...timesheetForm, client: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}>
                      <option value="">Select</option>
                      {clients.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Task *</label>
                    <select value={timesheetForm.task} onChange={e => setTimesheetForm({...timesheetForm, task: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}>
                      <option value="">Select</option>
                      {tasks.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Start Time *</label>
                    <input type="time" value={timesheetForm.startTime} onChange={e => setTimesheetForm({...timesheetForm, startTime: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>End Time *</label>
                    <input type="time" value={timesheetForm.endTime} onChange={e => setTimesheetForm({...timesheetForm, endTime: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Description</label>
                    <input value={timesheetForm.description} onChange={e => setTimesheetForm({...timesheetForm, description: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}} placeholder="Optional"/>
                  </div>
                </div>
                <button onClick={addEntry} disabled={isDateLocked(timesheetForm.date)} style={{padding:'10px 20px',background:isDateLocked(timesheetForm.date)?'#9ca3af':'#667eea',color:'white',border:'none',borderRadius:'6px',cursor:isDateLocked(timesheetForm.date)?'not-allowed':'pointer',fontWeight:'600',fontSize:'14px'}}>
                  <Plus size={16} style={{display:'inline',marginRight:'6px'}}/>Add Entry
                </button>

                <h3 style={{fontSize:'18px',fontWeight:'bold',marginTop:'30px',marginBottom:'15px'}}>
                  My Entries 
                  <span style={{marginLeft:'10px',padding:'4px 12px',background:'#667eea',color:'white',borderRadius:'20px',fontSize:'13px'}}>{totalHours} hrs</span>
                </h3>
                {myEntries.length === 0 ? (
                  <p style={{textAlign:'center',padding:'40px',color:'#999'}}>No entries yet</p>
                ) : (
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{background:'#f9fafb'}}>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Date</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Client</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Task</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Start</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>End</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Hours</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Description</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myEntries.map(e => (
                          <tr key={e.id} style={{borderBottom:'1px solid #e5e7eb',background:isDateLocked(e.date)?'#fef3c7':'transparent'}}>
                            <td style={{padding:'10px',fontSize:'13px'}}>
                              {e.date}
                              {isDateLocked(e.date) && <Lock size={12} style={{display:'inline',marginLeft:'6px',color:'#f59e0b'}}/>}
                            </td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.client}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.task}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.startTime}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.endTime}</td>
                            <td style={{padding:'10px',fontSize:'13px',fontWeight:'600'}}>{e.hours}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.description || '-'}</td>
                            <td style={{padding:'10px'}}>
                              <button onClick={() => deleteEntry(e.id, e.date)} disabled={isDateLocked(e.date)} style={{padding:'4px 8px',background:isDateLocked(e.date)?'#d1d5db':'#fee',color:isDateLocked(e.date)?'#6b7280':'#dc2626',border:'none',borderRadius:'4px',cursor:isDateLocked(e.date)?'not-allowed':'pointer'}}>
                                <Trash2 size={14}/>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reports' && isManager && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:'bold',marginBottom:'20px'}}>Timesheet Reports</h2>
                
                <div style={{padding:'20px',background:'#f0f9ff',borderRadius:'8px',marginBottom:'20px'}}>
                  <h3 style={{fontSize:'16px',fontWeight:'600',marginBottom:'12px'}}>Filters</h3>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:'12px'}}>
                    <div>
                      <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px'}}>Start Date</label>
                      <input type="date" value={reportFilters.startDate} onChange={e => setReportFilters({...reportFilters, startDate: e.target.value})} style={{width:'100%',padding:'6px',border:'1px solid #ddd',borderRadius:'4px',fontSize:'13px'}}/>
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px'}}>End Date</label>
                      <input type="date" value={reportFilters.endDate} onChange={e => setReportFilters({...reportFilters, endDate: e.target.value})} style={{width:'100%',padding:'6px',border:'1px solid #ddd',borderRadius:'4px',fontSize:'13px'}}/>
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px'}}>Client</label>
                      <select value={reportFilters.client} onChange={e => setReportFilters({...reportFilters, client: e.target.value})} style={{width:'100%',padding:'6px',border:'1px solid #ddd',borderRadius:'4px',fontSize:'13px'}}>
                        <option value="all">All Clients</option>
                        {clients.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px'}}>Task</label>
                      <select value={reportFilters.task} onChange={e => setReportFilters({...reportFilters, task: e.target.value})} style={{width:'100%',padding:'6px',border:'1px solid #ddd',borderRadius:'4px',fontSize:'13px'}}>
                        <option value="all">All Tasks</option>
                        {tasks.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px'}}>User</label>
                      <select value={reportFilters.user} onChange={e => setReportFilters({...reportFilters, user: e.target.value})} style={{width:'100%',padding:'6px',border:'1px solid #ddd',borderRadius:'4px',fontSize:'13px'}}>
                        <option value="all">All Users</option>
                        {users.filter(u => u.role === 'team').map(u => <option key={u.username} value={u.username}>{u.name}</option>)}
                      </select>
                    </div>
                    <div style={{display:'flex',alignItems:'flex-end',gap:'8px'}}>
                      <button onClick={() => setReportFilters({startDate:'',endDate:'',client:'all',task:'all',user:'all'})} style={{padding:'6px 12px',background:'#6b7280',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'13px'}}>Clear</button>
                      <button onClick={exportToCSV} style={{padding:'6px 12px',background:'#16a34a',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',gap:'4px'}}>
                        <Download size={14}/>CSV
                      </button>
                      <button onClick={exportToExcel} style={{padding:'6px 12px',background:'#0ea5e9',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',gap:'4px'}}>
                        <Download size={14}/>Excel
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{marginBottom:'15px',padding:'12px',background:'#667eea',color:'white',borderRadius:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'16px',fontWeight:'600'}}>Report Results</span>
                  <span style={{fontSize:'18px',fontWeight:'bold'}}>{reportEntries.length} entries • {reportTotal} hours</span>
                </div>

                {reportEntries.length === 0 ? (
                  <p style={{textAlign:'center',padding:'40px',color:'#999'}}>No entries match the filters</p>
                ) : (
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{background:'#f9fafb'}}>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Date</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>User</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Client</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Task</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Start</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>End</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Hours</th>
                          <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportEntries.map(e => (
                          <tr key={e.id} style={{borderBottom:'1px solid #e5e7eb'}}>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.date}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.name}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.client}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.task}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.startTime}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.endTime}</td>
                            <td style={{padding:'10px',fontSize:'13px',fontWeight:'600'}}>{e.hours}</td>
                            <td style={{padding:'10px',fontSize:'13px'}}>{e.description || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'locks' && isManager && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:'bold',marginBottom:'20px'}}>Lock Timesheet Dates</h2>
                
                <div style={{padding:'20px',background:'#fef3c7',borderRadius:'8px',marginBottom:'20px',border:'2px solid #fbbf24'}}>
                  <h3 style={{fontSize:'16px',fontWeight:'600',marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
                    <Lock size={20}/>Lock New Date
                  </h3>
                  <p style={{fontSize:'13px',color:'#78716c',marginBottom:'12px'}}>
                    Once a date is locked, team members will not be able to add, edit, or delete timesheet entries for that date.
                  </p>
                  <div style={{display:'flex',gap:'10px',alignItems:'flex-end'}}>
                    <div style={{flex:1}}>
                      <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Select Date to Lock</label>
                      <input 
                        type="date" 
                        value={lockDate} 
                        onChange={e => setLockDate(e.target.value)} 
                        style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}
                      />
                    </div>
                    <button 
                      onClick={handleLockDate} 
                      style={{padding:'8px 20px',background:'#f59e0b',color:'white',border:'none',borderRadius:'5px',cursor:'pointer',fontWeight:'600',fontSize:'14px',display:'flex',alignItems:'center',gap:'6px'}}
                    >
                      <Lock size={16}/>Lock Date
                    </button>
                  </div>
                </div>

                <h3 style={{fontSize:'18px',fontWeight:'bold',marginBottom:'15px'}}>
                  Locked Dates ({lockedDates.length})
                </h3>
                
                {lockedDates.length === 0 ? (
                  <p style={{textAlign:'center',padding:'40px',color:'#999'}}>No locked dates</p>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))',gap:'10px'}}>
                    {lockedDates.sort().reverse().map(date => (
                      <div key={date} style={{padding:'12px',background:'#fef3c7',borderRadius:'6px',display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid #fbbf24'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          <Lock size={16} style={{color:'#f59e0b'}}/>
                          <span style={{fontSize:'14px',fontWeight:'500'}}>{date}</span>
                        </div>
                        <button 
                          onClick={() => unlockDate(date)} 
                          style={{padding:'4px 12px',background:'#16a34a',color:'white',border:'none',borderRadius:'4px',cursor:'pointer',fontSize:'12px',display:'flex',alignItems:'center',gap:'4px'}}
                        >
                          <Unlock size={12}/>Unlock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && isManager && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:'bold',marginBottom:'20px'}}>Manage Users</h2>
                <div style={{padding:'20px',background:'#f0fdf4',borderRadius:'8px',marginBottom:'20px'}}>
                  <h3 style={{fontSize:'16px',fontWeight:'600',marginBottom:'12px'}}>Add New User</h3>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:'10px'}}>
                    <input placeholder="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} style={{padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}/>
                    <input type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} style={{padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}/>
                    <input placeholder="Full Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} style={{padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}/>
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={{padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}>
                      <option value="team">Team</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button onClick={addUser} style={{padding:'8px 16px',background:'#16a34a',color:'white',border:'none',borderRadius:'5px',cursor:'pointer',fontWeight:'600'}}>
                      <Plus size={16} style={{display:'inline',marginRight:'4px'}}/>Add
                    </button>
                  </div>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#f9fafb'}}>
                      <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Username</th>
                      <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Name</th>
                      <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Role</th>
                      <th style={{padding:'10px',textAlign:'left',fontSize:'13px',fontWeight:'600'}}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.username} style={{borderBottom:'1px solid #e5e7eb'}}>
                        <td style={{padding:'10px',fontSize:'13px'}}>{u.username}</td>
                        <td style={{padding:'10px',fontSize:'13px'}}>{u.name}</td>
                        <td style={{padding:'10px',fontSize:'13px'}}>
                          <span style={{padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:'600',background:u.role==='manager'?'#e0e7ff':'#dcfce7',color:u.role==='manager'?'#4f46e5':'#16a34a'}}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{padding:'10px'}}>
                          {u.username !== currentUser.username && (
                            <button onClick={() => deleteUser(u.username)} style={{padding:'4px 8px',background:'#fee',color:'#dc2626',border:'none',borderRadius:'4px',cursor:'pointer'}}>
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'clients' && isManager && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:'bold',marginBottom:'20px'}}>Manage Clients ({clients.length})</h2>
                
                <div style={{padding:'20px',background:'#eff6ff',borderRadius:'8px',marginBottom:'20px',border:'2px solid #3b82f6'}}>
                  <h3 style={{fontSize:'16px',fontWeight:'600',marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>
                    <Upload size={20}/>Import Clients from Excel/CSV
                  </h3>
                  <p style={{fontSize:'13px',color:'#64748b',marginBottom:'12px'}}>
                    Upload an Excel (.xlsx, .xls) or CSV file with client names in the first column. The first row can be a header.
                  </p>
                  <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv" 
                    onChange={handleClientImport}
                    style={{padding:'8px',border:'1px solid #ddd',borderRadius:'5px',background:'white',width:'100%'}}
                  />
                </div>

                <div style={{display:'flex',gap:'10px',marginBottom:'20px'}}>
                  <input placeholder="Client name" value={newClient} onChange={e => setNewClient(e.target.value)} onKeyPress={e => e.key === 'Enter' && addClient()} style={{flex:1,padding:'10px',border:'1px solid #ddd',borderRadius:'5px'}}/>
                  <button onClick={addClient} style={{padding:'10px 20px',background:'#667eea',color:'white',border:'none',borderRadius:'5px',cursor:'pointer',fontWeight:'600'}}>
                    <Plus size={16} style={{display:'inline',marginRight:'6px'}}/>Add
                  </button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))',gap:'10px'}}>
                  {clients.map(c => (
                    <div key={c} style={{padding:'12px',background:'#f9fafb',borderRadius:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:'14px',fontWeight:'500'}}>{c}</span>
                      <button onClick={() => deleteClient(c)} style={{padding:'4px 8px',background:'#fee',color:'#dc2626',border:'none',borderRadius:'4px',cursor:'pointer'}}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tasks' && isManager && (
              <div>
                <h2 style={{fontSize:'20px',fontWeight:'bold',marginBottom:'20px'}}>Manage Tasks ({tasks.length})</h2>
                <div style={{display:'flex',gap:'10px',marginBottom:'20px'}}>
                  <input placeholder="Task name" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyPress={e => e.key === 'Enter' && addTask()} style={{flex:1,padding:'10px',border:'1px solid #ddd',borderRadius:'5px'}}/>
                  <button onClick={addTask} style={{padding:'10px 20px',background:'#667eea',color:'white',border:'none',borderRadius:'5px',cursor:'pointer',fontWeight:'600'}}>
                    <Plus size={16} style={{display:'inline',marginRight:'6px'}}/>Add
                  </button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))',gap:'10px'}}>
                  {tasks.map(t => (
                    <div key={t} style={{padding:'12px',background:'#f9fafb',borderRadius:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:'14px',fontWeight:'500'}}>{t}</span>
                      <button onClick={() => deleteTask(t)} style={{padding:'4px 8px',background:'#fee',color:'#dc2626',border:'none',borderRadius:'4px',cursor:'pointer'}}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'white',padding:'30px',borderRadius:'10px',width:'100%',maxWidth:'400px'}}>
            <h3 style={{fontSize:'20px',fontWeight:'bold',marginBottom:'20px'}}>Change Password</h3>
            <div style={{marginBottom:'15px'}}>
              <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Current Password</label>
              <input type="password" value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}/>
            </div>
            <div style={{marginBottom:'15px'}}>
              <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>New Password (min 6 chars)</label>
              <input type="password" value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}/>
            </div>
            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'4px'}}>Confirm New Password</label>
              <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} style={{width:'100%',padding:'8px',border:'1px solid #ddd',borderRadius:'5px'}}/>
            </div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={changePassword} style={{flex:1,padding:'10px',background:'#667eea',color:'white',border:'none',borderRadius:'5px',cursor:'pointer',fontWeight:'600'}}>Change Password</button>
              <button onClick={() => {setShowPasswordModal(false); setPasswordForm({current:'',new:'',confirm:''})}} style={{flex:1,padding:'10px',background:'#6b7280',color:'white',border:'none',borderRadius:'5px',cursor:'pointer',fontWeight:'600'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
