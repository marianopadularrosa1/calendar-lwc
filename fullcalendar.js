import { LightningElement, track, api } from 'lwc';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import FullCalendarJS from '@salesforce/resourceUrl/fullcalendar3';
import fetchEvents from '@salesforce/apex/FullCalendarController.fetchEvents';
import fetchEventsById from '@salesforce/apex/FullCalendarController.fetchEventsById';
import createEvent from '@salesforce/apex/FullCalendarController.createEvent';
import deleteEvent from '@salesforce/apex/FullCalendarController.deleteEvent';
import updateEvent from '@salesforce/apex/FullCalendarController.updateEvent';
import findObjectAPIName from '@salesforce/apex/FullCalendarController.findObjectAPIName';
import { NavigationMixin } from 'lightning/navigation';
import TIMEZONE from '@salesforce/i18n/timeZone';

export default class Fullcalendar  extends NavigationMixin(LightningElement)  {

    fullCalendarJsInitialised = false;

  title;
  startDate;
  endDate;

  @api eventsRendered = false;
  openSpinner = false; 
  openModal = false; 
  @api events = []; 
  eventOriginalData = [];
  @api recordId;

  async loadLibraries(){
    let result;
    try {
        await loadScript(this, FullCalendarJS + "/fullcalendar-3.10.0/lib/jquery.min.js");
        await loadScript(this, FullCalendarJS + "/fullcalendar-3.10.0/lib/moment.min.js");
        await loadScript(this, FullCalendarJS + "/fullcalendar-3.10.0/fullcalendar.min.js");
        await loadStyle(this, FullCalendarJS +  "/fullcalendar-3.10.0/fullcalendar.min.css");
        result='ok';
    }catch (error) {
        console.log('error loading library',error);
        result='error';
    }
    finally{
        return result;
    }
}

 async loadfetchEvents(recordId){
    
    let result;
    let events;
    try {
        if(recordId){
            result = await fetchEventsById({Id: recordId});
        }else{
            result = await fetchEvents();
        }
        console.log('result   ',result);
        const {data, error} = result;
        
        if(result){
            
            events = result.map(event => {
                return { id : event.Id, 
                        title : event.Subject, 
                        start : event.StartDateTime,
                       
                        end : event.EndDateTime,
                        allDay : event.IsAllDayEvent,
                        description: event.Description,
                        extendedProps:{ 
                            whoId : event.WhoId,
                            whatId: event.WhatId,
                            assignedTo: event.Owner.Name
                        },
                        backgroundColor: "rgb(1,118,211)",
                        borderColor: "rgb(1,118,211)",
                    };
            });
            
            this.error = undefined;
        }else if(error){
            this.events = [];
            this.error = 'No events are found';
        }
    } catch (error) {
        console.log('error on fetchEvents',error)
       }
    finally{
        return events;
    }
}

async renderEvents (eventsToRender){
    let result;
    try {
            const ele = this.template.querySelector("div.fullcalendarjs");
            result = await $(ele).fullCalendar('renderEvents', eventsToRender, true);
            result = 'ok';
    } catch (error) {
        console.log('error render events',error);
        result= error;
    }
    finally{
        return result;
    }
}
async loadFindObjectAPIName(recordId){
    let result;
    try {
        result = await findObjectAPIName({recordId:recordId});
    } catch (error) {
        result = undefined;
    }
    finally{
        return result;
    }

}


async connectedCallback(){
    
    //let objectAPIName = await this.loadFindObjectAPIName(this.recordId);
    let loadlibrariesResult = await this.loadLibraries();
    this.events = await this.loadfetchEvents(this.recordId);
    await this.initialiseFullCalendarJs();
    this.eventsRendered = true;
}


 renderedCallback() {
    
    if (this.fullCalendarJsInitialised) {
       return;
    }
    this.fullCalendarJsInitialised = true; 

    
 }

  async initialiseFullCalendarJs() {
      
      const ele = this.template.querySelector("div.fullcalendarjs");
      const modal = this.template.querySelector('div.modalclass');

      var self = this;

      function openActivityForm(startDate, endDate){
          
          self.startDate = startDate;
          self.endDate = endDate;
          self.openModal = true;
      }

      $(ele).fullCalendar({
        
        header: {
            left: "prev,next today",
            center: "title",
            right: "month,agendaWeek,agendaDay",
        },
        defaultDate: new Date(), // default day is today
        defaultView : 'month', //To display the default view
        navLinks: true, 
        editable: true,  
        selectable: true, //To select the period of time
        weekNumbers: true,
        themeSystem:'standard',
        timeFormat: 'H:mm',
        nowIndicator:true,
        dragScroll: true,
        droppable: true,
        views:{
            agenda:{
                weekends:false
            }
        },


        //To select the time period : https://fullcalendar.io/docs/v3/select-method
        select: function (startDate, endDate) {
            let stDate = startDate.format();
            let edDate = endDate.format();
            openActivityForm(stDate, edDate);
        },
        eventLimit: true, 
        events: this.events, // all the events that are to be rendered - can be a duplicate statement here
        
        eventClick: (event) => {
            this.handleEventClick(event);
        },
        eventMouseover:(event, jsEvent, view)=>{
            //console.log('event hover over:::',event.title)
        },
        eventRender:(event,jsevent)=>{
            jsevent.attr('title',event.title);
        },
        //eventDrop meant to manage after dragging event https://fullcalendar.io/docs/v3/eventDrop
        eventDrop: (event, delta, revertFunc)=> {
            alert(event.title + " was dropped on start:" + event.start.format() + ", end:"+ event.end.format());
            if (!confirm("Are you sure about this change?")) {
              revertFunc();
            }else{
                //is in development update event https://fullcalendar.io/docs/v3/updateEvent
                let ele = this.template.querySelector("div.fullcalendarjs");
                let newtitle = 'UPDATED:' + event.title;
                event.title = newtitle;
                $(ele).fullCalendar( 'updateEvent', event );
                this.handleUpdateEvent(event);
            } 
        
          }
        

      });
      
  }

  handleKeyup(event) {
      this.title = event.target.value;
  }
  
  //To close the modal form
  handleCancel(event) {
      this.openModal = false;
  }

 /*
 @description: handle asyncronously the apex methods meant to save new Event loadFindObjectAPIName, loadCreateEvent
 */
  async handleSave(event) {
      let events = this.events;
      this.openSpinner = true;
      
      this.template.querySelectorAll('lightning-input').forEach(ele => {
          if(ele.name === 'title'){
             this.title = ele.value;
         }
         if(ele.name === 'start'){
              this.startDate = ele.value.includes('.000Z') ? ele.value : ele.value + '.000Z';
          }
          if(ele.name === 'end'){
              this.endDate = ele.value.includes('.000Z') ? ele.value : ele.value + '.000Z';
          }
          
      });
      let newevent;
      if(this.recordId){
        let objectApiName = await this.loadFindObjectAPIName(this.recordId);
        console.log('objectApiName:', objectApiName);
        if(objectApiName==='Lead' || objectApiName==='Contact' ){
            newevent = {title : this.title, start : this.startDate, end: this.endDate, whoId: this.recordId};
        }else{
            newevent = {title : this.title, start : this.startDate, end: this.endDate, whatId: this.recordId};
        }
      }else{
        newevent = {title : this.title, start : this.startDate, end: this.endDate};
      }
     
      //Close the modal
      this.openModal = false;
      //Server call to create the event
      let createdEvent = await this.loadCreateEvent(newevent);
      if(createdEvent){
        this.showNotification('Success!', 'The event: "'+ createdEvent.title +'" has been created successfully', 'success');
      }
      else{
        console.log('error::',error)
        this.showNotification('Oops', 'Something went wrong, please review console' + error, 'error');
      }
      
 }

 async loadCreateEvent(newEvent){
    let result;
    try {
        
        result = await createEvent({'event' : JSON.stringify(newEvent)});
        newEvent.id = result;
    } catch (error) {
        console.log(error);
        this.openSpinner = false;
        return undefined;
    }
    finally{
        const ele = this.template.querySelector("div.fullcalendarjs");
        //renderEvent: https://fullcalendar.io/docs/v3/renderEvent
        await $(ele).fullCalendar( 'renderEvent', newEvent, true );
        this.events.push(newEvent);
        this.openSpinner = false;
        this.eventsRendered = true;
        console.log('newEvent:::',newEvent);
        return newEvent;
    }
 }
 
 
 async removeEvent (event){
    this.openSpinner = true;
    this.eventsRendered = false;
    let eventid = event.target.value;
    let result;
    try {
        //delete event with apex call
        result = await deleteEvent({eventid : eventid});
    } catch (error) {
        console.log(error);
    }
    finally{
        //get events from backend with apex to render cards in left bar
        this.events = await this.loadfetchEvents();

        //remove event from frontEnd using https://fullcalendar.io/docs/v3/removeEvents
        let ele = this.template.querySelector("div.fullcalendarjs");
        await $(ele).fullCalendar( 'removeEvents', [eventid] );
        this.openSpinner = false;
        this.eventsRendered = true;
    }
 }

  addEvent(event) {
      this.startDate = null;
      this.endDate = null;
      this.title = null;
      this.openModal = true;
  }


  showNotification(title, message, variant) {
      console.log('showNotification');
      const evt = new ShowToastEvent({
          title: title,
          message: message,
          variant: variant,
      });
      this.dispatchEvent(evt);
  }

  async handleEventClick(event) {
    let eventid= (event.id).substr(0,18);
    this.navigateToEditEventPage(eventid);
  }
   // Navigate to Edit Event Page
   navigateToEditEventPage(eventid) {
    this[NavigationMixin.Navigate]({
        type: 'standard__recordPage',
        attributes: {
            recordId: eventid,
            objectApiName: 'Event',
            actionName: 'edit'
            },
        });
    }

    async handleUpdateEvent(event){
        let result;
        try {
          result = await updateEvent({event : event});  
        } catch (error) {
            console.log('handleUpdateEvent::',error);
        }
        finally{
            return result;
        }
    }
    
    convertTimezone(date, timezoneString){
        let newDate;
        if(typeof date === "string"){
            newDate = new Date(date).toLocaleString("en-US", {timezone: timezoneString});
        }else{
            newDate = date.toLocaleString("en-US", {timezone: timezoneString});
        }
        return newDate;
    }

}
