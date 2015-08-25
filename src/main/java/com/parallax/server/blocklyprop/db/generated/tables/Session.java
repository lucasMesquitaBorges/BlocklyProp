/**
 * This class is generated by jOOQ
 */
package com.parallax.server.blocklyprop.db.generated.tables;


import com.parallax.server.blocklyprop.db.generated.Blocklyprop;
import com.parallax.server.blocklyprop.db.generated.Keys;
import com.parallax.server.blocklyprop.db.generated.tables.records.SessionRecord;

import java.sql.Timestamp;
import java.util.Arrays;
import java.util.List;

import javax.annotation.Generated;

import org.jooq.Field;
import org.jooq.Table;
import org.jooq.TableField;
import org.jooq.UniqueKey;
import org.jooq.impl.TableImpl;


/**
 * This class is generated by jOOQ.
 */
@Generated(
	value = {
		"http://www.jooq.org",
		"jOOQ version:3.6.1"
	},
	comments = "This class is generated by jOOQ"
)
@SuppressWarnings({ "all", "unchecked", "rawtypes" })
public class Session extends TableImpl<SessionRecord> {

	private static final long serialVersionUID = 2126734164;

	/**
	 * The reference instance of <code>blocklyprop.session</code>
	 */
	public static final Session SESSION = new Session();

	/**
	 * The class holding records for this type
	 */
	@Override
	public Class<SessionRecord> getRecordType() {
		return SessionRecord.class;
	}

	/**
	 * The column <code>blocklyprop.session.idsession</code>.
	 */
	public final TableField<SessionRecord, String> IDSESSION = createField("idsession", org.jooq.impl.SQLDataType.VARCHAR.length(255).nullable(false), this, "");

	/**
	 * The column <code>blocklyprop.session.startTimestamp</code>.
	 */
	public final TableField<SessionRecord, Timestamp> STARTTIMESTAMP = createField("startTimestamp", org.jooq.impl.SQLDataType.TIMESTAMP.nullable(false).defaulted(true), this, "");

	/**
	 * The column <code>blocklyprop.session.lastAccessTime</code>.
	 */
	public final TableField<SessionRecord, Timestamp> LASTACCESSTIME = createField("lastAccessTime", org.jooq.impl.SQLDataType.TIMESTAMP.nullable(false).defaulted(true), this, "");

	/**
	 * The column <code>blocklyprop.session.timeout</code>.
	 */
	public final TableField<SessionRecord, Long> TIMEOUT = createField("timeout", org.jooq.impl.SQLDataType.BIGINT, this, "");

	/**
	 * The column <code>blocklyprop.session.host</code>.
	 */
	public final TableField<SessionRecord, String> HOST = createField("host", org.jooq.impl.SQLDataType.VARCHAR.length(255), this, "");

	/**
	 * The column <code>blocklyprop.session.attributes</code>.
	 */
	public final TableField<SessionRecord, String> ATTRIBUTES = createField("attributes", org.jooq.impl.SQLDataType.CLOB, this, "");

	/**
	 * Create a <code>blocklyprop.session</code> table reference
	 */
	public Session() {
		this("session", null);
	}

	/**
	 * Create an aliased <code>blocklyprop.session</code> table reference
	 */
	public Session(String alias) {
		this(alias, SESSION);
	}

	private Session(String alias, Table<SessionRecord> aliased) {
		this(alias, aliased, null);
	}

	private Session(String alias, Table<SessionRecord> aliased, Field<?>[] parameters) {
		super(alias, Blocklyprop.BLOCKLYPROP, aliased, parameters, "");
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public UniqueKey<SessionRecord> getPrimaryKey() {
		return Keys.KEY_SESSION_PRIMARY;
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public List<UniqueKey<SessionRecord>> getKeys() {
		return Arrays.<UniqueKey<SessionRecord>>asList(Keys.KEY_SESSION_PRIMARY);
	}

	/**
	 * {@inheritDoc}
	 */
	@Override
	public Session as(String alias) {
		return new Session(alias, this);
	}

	/**
	 * Rename this table
	 */
	public Session rename(String name) {
		return new Session(name, null);
	}
}
