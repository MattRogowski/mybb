<?php
/**
 * MyBB 1.2
 * Copyright � 2006 MyBB Group, All Rights Reserved
 *
 * Website: http://www.mybboard.com
 * License: http://www.mybboard.com/eula.html
 *
 * $Id$
 */

/**
 * Event handling class, provides common structure to handle event data.
 *
 */
class EventDataHandler extends DataHandler
{
	/**
	* The language file used in the data handler.
	*
	* @var string
	*/
	var $language_file = 'datahandler_event';
	
	/**
	* The prefix for the language variables used in the data handler.
	*
	* @var string
	*/
	var $language_prefix = 'eventdata';

	/**
	 * Verifies if an event name is valid or not and attempts to fix it
	 *
	 * @return boolean True if valid, false if invalid.
	 */
	function verify_subject()
	{
		$subject = &$this->data['subject'];
		$subject = trim($subject);
		if(!$subject)
		{
			$this->set_error("missing_subject");
			return false;
		}
		return true;
	}

	/**
	 * Verifies if an event description is valid or not and attempts to fix it
	 *
	 * @return boolean True if valid, false if invalid.
	 */
	function verify_description()
	{
		$description = &$this->data['description'];
		$description = trim($description);
		if(!$description)
		{
			$this->set_error("missing_description");
			return false;
		}
		return true;
	}

	/**
	 * Verifies if an event date is valid or not and attempts to fix it
	 *
	 * @return boolean True if valid, false if invalid.
	 */
	function verify_date()
	{
		$event = &$this->data;

		// Check if the date is complete.
		if(!$event['day'] || !$event['month'] || !$event['year'])
		{
			$this->set_error("invalid_date");
			return false;
		}
		
		// Calendar events can only be within the next 5 years
		if($event['year'] > date("Y") + 5)
		{
			$this->set_error("invalid_year");
			return false;
		}

		// Check if the day actually exists.
		if($event['day'] > date("t", mktime(0, 0, 0, $event['month'], 1, $event['year'])))
		{
			$this->set_error("invalid_day");
			return false;
		}
		$event['date'] = intval($event['day'])."-".intval($event['month'])."-".intval($event['year']);
		return true;
	}

	/**
	 * Verifies if the user is allowed to add public or private events.
	 *
	 * @param string If the event is private (yes) or not (no).
	 * @return boolean True or false depending on their permission.
	 */
	function verify_scope()
	{
		global $mybb;

		$event = &$this->data;

		$user_permissions = user_permissions($event['uid']);

		// If a private event
		if($event['private'] == "yes")
		{
			// Can the user add private events?
			if($event['uid'] == 0 || $user_permissions['canaddprivateevents'] == "no")
			{
				$this->set_error("no_permission_private_event");
				return false;
			}
		}
		else
		{
			// Public event, got permission?
			if($user_permissions['canaddpublicevents'] == "no")
			{
				$this->set_error("no_permission_public_event");
				return false;
			}
			// Default value
			$event['private'] = 'no';
		}
		return true;
	}


	/**
	 * Validate an event.
	 *
	 * @param array The event data array.
	 */
	function validate_event()
	{
		global $plugins;

		$event = &$this->data;

		if($this->method == "insert" || isset($event['subject']))
		{
			$this->verify_subject();
		}

		if($this->method == "insert" || isset($event['description']))
		{
			$this->verify_description();
		}

		if($this->method == "insert" || isset($event['day']))
		{
			$this->verify_date();
		}
	
		if($this->method == "insert" || isset($event['private']))
		{
			$this->verify_scope();
		}
		$plugins->run_hooks("datahandler_event_validate");

		// We are done validating, return.
		$this->set_validated(true);
		if(count($this->get_errors()) > 0)
		{
			return false;
		}
		else
		{
			return true;
		}
	}

	/**
	 * Insert an event into the database.
	 *
	 * @param array The array of event data.
	 * @return array Array of new event details, eid and private.
	 */
	function insert_event()
	{
		global $db, $mybb, $plugins;

		// Yes, validating is required.
		if(!$this->get_validated())
		{
			die("The event needs to be validated before inserting it into the DB.");
		}
		if(count($this->get_errors()) > 0)
		{
			die("The event is not valid.");
		}

		$event = &$this->data;

		// Prepare an array for insertion into the database.
		$newevent = array(
			'subject' => $db->escape_string($event['subject']),
			'author' => intval($event['uid']),
			'date' => $event['date'],
			'description' => $db->escape_string($event['description']),
			'private' => $event['private']
		);
		$db->insert_query(TABLE_PREFIX."events", $newevent);
		$eid = $db->insert_id();

		$plugins->run_hooks("datahandler_event_insert");

		// Return the event's eid and whether or not it is private.
		return array(
			'eid' => $eid,
			'private' => $event['private']
		);
	}

	/**
	 * Updates an event that is already in the database.
	 *
	 * @param array The event data array.
	 */
	function update_event()
	{
		global $db, $plugins;

		// Yes, validating is required.
		if(!$this->get_validated())
		{
			die("The event needs to be validated before inserting it into the DB.");
		}
		if(count($this->get_errors()) > 0)
		{
			die("The event is not valid.");
		}

		$event = &$this->data;

		$updateevent = array();

		if(isset($event['subject']))
		{
			$updateevent['subject'] = $db->escape_string($event['subject']);
		}

		if(isset($event['description']))
		{
			$updateevent['description'] = $db->escape_string($event['description']);
		}

		if(isset($event['date']))
		{
			$updateevent['date'] = $db->escape_string($event['date']);
		}

		if(isset($event['private']))
		{
			$updateevent['private'] = $db->escape_string($event['private']);
		}

		if(isset($event['uid']))
		{
			$updateevent['author'] = intval($event['uid']);
		}

		$db->update_query(TABLE_PREFIX."events", $updateevent, "eid='".intval($event['eid'])."'");

		$plugins->run_hooks("datahandler_event_update");

		// Return the event's eid and whether or not it is private.
		return array(
			'eid' => $event['eid'],
			'private' => $event['private']
		);
	}

	/**
	 * Delete an event from the database.
	 *
	 * @param int The event id of the even that is to be deleted.
	 */
	function delete_by_eid($eid)
	{
		global $db, $plugins;

		$db->delete_query(TABLE_PREFIX."events", "eid=".intval($eid), 1);

		$plugins->run_hooks("datahandler_event_delete");
	}
}

?>