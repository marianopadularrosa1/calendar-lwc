public with sharing class FullCalendarController {

    @AuraEnabled
    public static List<Event> fetchEvents() {
        return [SELECT Id, Subject, StartDateTime, IsAllDayEvent, EndDateTime , WhoId,WhatId, Owner.Name, OwnerId ,Description
                FROM Event 
                WHERE StartDateTime >= LAST_90_DAYS 
                ORDER BY CreatedDate DESC
                LIMIT 200];
    }

    @AuraEnabled
    public static List<Event> fetchEventsById(String Id) {
        String apiName = findObjectAPIName(Id);
        List<Event> events = new List<Event>(); 
        
        if ( new List<String>{'Contact','Lead'}.contains(apiName)) {
            events = [SELECT Id, Subject, StartDateTime, IsAllDayEvent, EndDateTime , WhoId,WhatId, Owner.Name, OwnerId,Description
                    FROM Event 
                    WHERE StartDateTime >= LAST_90_DAYS 
                    AND WhoId=:Id
                    ORDER BY CreatedDate DESC
                    LIMIT 200];
            
        } else if(new List<String>{'Opportunity','Account','Campaign','Case'}.contains(apiName)) {
            events = [SELECT Id, Subject, StartDateTime, IsAllDayEvent, EndDateTime , WhoId,WhatId, Owner.Name,OwnerId,Description
                    FROM Event 
                    WHERE StartDateTime >= LAST_90_DAYS 
                    AND WhatId=:Id
                    ORDER BY CreatedDate DESC
                    LIMIT 200];
        }else if(apiName.contains('__c')){
            //Custom Objects so far are linked with whatid
            events = [SELECT Id, Subject, StartDateTime, IsAllDayEvent, EndDateTime , WhoId,WhatId, Owner.Name,OwnerId,Description
                    FROM Event 
                    WHERE StartDateTime >= LAST_90_DAYS 
                    AND WhatId=:Id
                    ORDER BY CreatedDate DESC
                    LIMIT 200];
        }else{
            return events;
        }
        return events;
    }
    @AuraEnabled
    public static string findObjectAPIName(String recordId){
        if(recordId == null)
            return null;
        String objectAPIName = '';
        String keyPrefix = recordId.substring(0,3);
         for( Schema.SObjectType obj : Schema.getGlobalDescribe().Values() ){
              String prefix = obj.getDescribe().getKeyPrefix();
               if(prefix == keyPrefix){
                         objectAPIName = obj.getDescribe().getName();
                          break;
                }
         }
         return objectAPIName;
}
    


    @AuraEnabled
    public static Id createEvent(String event){

        if(String.isBlank(event)){
            return null;
        }
        Map<String, Object> eventMap = (Map<String, Object>) JSON.deserializeUntyped(event);
        
        Event newEvent = new Event();
        newEvent.Subject = eventMap.get('title') != null ? (String)eventMap.get('title') : null;

        String startdate = eventMap.get('start') != null ? 
                            ((String)eventMap.get('start')).replace('T', ' ').replace('.000Z', '') : 
                            null;
        String endDate = eventMap.get('end') != null ? 
                            ((String)eventMap.get('end')).replace('T', ' ').replace('.000Z', '') : 
                            null;

        String whatId = eventMap.get('whatId')!=null ? (String) eventMap.get('whatId'):null;
        String whoId = eventMap.get('whoId')!=null ? (String) eventMap.get('whoId'):null;

        newEvent.StartDateTime = startdate != null ? Datetime.valueOfGmt(startdate) : null;
        newEvent.EndDateTime = endDate != null ? Datetime.valueOfGmt(endDate) : null;
        newEvent.WhatId = whatId;
        newEvent.WhoId = whoId;
        insert newEvent;
        return newEvent.Id;
    }

    @AuraEnabled
    public static void deleteEvent(Id eventid) {
       
        if(eventid != null){
            delete [SELECT Id FROM Event Where Id=:eventid];
        }else{
            throw new EventException('Event id is not passed');
        }

    }
    @AuraEnabled
    public static String updateEvent(Object event){
        System.debug('event receivd:'+event);
        if(event==null){
            return null;
        }
        Map<String, Object> eventMap = (Map<String, Object>) JSON.deserializeUntyped((String)event);
        Event eventToUpdate = new Event();
        eventToUpdate.Id = (String)eventMap.get('Id');
        eventToUpdate.Subject = eventMap.get('title') != null ? (String)eventMap.get('title') : null;

        String startdate = eventMap.get('start') != null ? 
                            ((String)eventMap.get('start')).replace('T', ' ').replace('.000Z', '') : 
                            null;
        String endDate = eventMap.get('end') != null ? 
                            ((String)eventMap.get('end')).replace('T', ' ').replace('.000Z', '') : 
                            null;

        eventToUpdate.StartDateTime = startdate != null ? Datetime.valueOfGmt(startdate) : null;
        eventToUpdate.EndDateTime = endDate != null ? Datetime.valueOfGmt(endDate) : null;
        System.debug('eventToUpdate :'+eventToUpdate);
        update eventToUpdate;
        return eventToUpdate.Id;

    }
    
    public class EventException extends Exception {}

}
